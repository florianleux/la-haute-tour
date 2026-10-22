import { beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { setDatabase } from '../../server/db/client'
import { activeEffects, pocketSpells, users } from '../../server/db/schema'
import { createPlayer, createQuestion, createTestDatabase } from '../helpers/db'
import { apiRequest, installNitroGlobals, mountHandler, sessionCookieFor } from '../helpers/nitro'
import type { Database } from '../../server/db/client'

installNitroGlobals()

const { default: stateHandler } = await import('../../server/api/game/state.get')
const { default: nextHandler } = await import('../../server/api/game/next.post')
const { default: answerHandler } = await import('../../server/api/game/answer.post')
const { default: logHandler } = await import('../../server/api/game/question-log.get')
const { default: chestHandler } = await import('../../server/api/game/chest.post')
const { default: disputableHandler } = await import('../../server/api/game/disputable-errors.get')
const { default: unknownHandler } = await import('../../server/api/[...]')

const state = mountHandler('/state', stateHandler)
const next = mountHandler('/next', nextHandler)
const answer = mountHandler('/answer', answerHandler)
const log = mountHandler('/question-log', logHandler)
const chest = mountHandler('/chest', chestHandler)
const disputable = mountHandler('/disputable-errors', disputableHandler)
const unknown = mountHandler('/api/nimportequoi', unknownHandler)

function post(path: string, body: unknown, cookie?: string): Request {
  return new Request(`http://test${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  })
}

describe('endpoints de jeu', () => {
  let db: Database
  let cookie: string

  beforeEach(async () => {
    db = await createTestDatabase()
    setDatabase(db)
    cookie = await sessionCookieFor(await createPlayer(db))
    await createQuestion(db, { statement: 'Capitale de la Gironde ?', accepted: ['Bordeaux'] })
  })

  it('refuse tout sans session', async () => {
    expect((await state(apiRequest('http://test/state'))).status).toBe(401)
    expect((await next(post('/next', {}))).status).toBe(401)
    expect((await answer(post('/answer', { answer: 'Bordeaux' }))).status).toBe(401)
    expect((await log(apiRequest('http://test/question-log'))).status).toBe(401)
    expect((await chest(post('/chest', {}))).status).toBe(401)
  })

  it('rend l état courant sans rien réserver', async () => {
    const response = await state(apiRequest('http://test/state', cookie))

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      phase: 'ascent',
      floor: 1,
      lives: 3,
      seenTotal: 0,
      question: null,
      verdict: null,
    })
  })

  // La leçon du Grimoire fait lancer Vitalité tant que c'est possible : en
  // poche, et rien encore lancé. Voir specs/ecrans.md#leçons-de-michel.
  it('dit le premier lancer à faire, Vitalité en poche, jusqu au premier lancer', async () => {
    const userId = await createPlayer(db, { discordId: 'apprenti', username: 'apprenti' })
    const read = async (): Promise<boolean> =>
      (await (await state(apiRequest('http://test/state', await sessionCookieFor(userId)))).json()).firstCastPending

    expect(await read()).toBe(false)

    await db.insert(pocketSpells).values({ userId, spell: 'RESPITE', obtainedAt: new Date() })
    expect(await read()).toBe(false)

    await db.insert(pocketSpells).values({ userId, spell: 'VITALITY', obtainedAt: new Date() })
    expect(await read()).toBe(true)

    await db.insert(activeEffects).values({
      userId,
      casterId: userId,
      spell: 'RESPITE',
      face: 'boon',
      castAt: new Date(),
      castCooldownStartedAt: new Date(),
    })
    expect(await read()).toBe(false)
  })

  it('pose le grimoire au premier sort obtenu, et le garde une fois lancé', async () => {
    const userId = await createPlayer(db, { discordId: 'sorcier', username: 'sorcier' })
    const read = async (): Promise<boolean> =>
      (await (await state(apiRequest('http://test/state', await sessionCookieFor(userId)))).json()).spellDiscovered

    expect(await read()).toBe(false)

    await db.insert(pocketSpells).values({ userId, spell: 'VITALITY', obtainedAt: new Date() })
    expect(await read()).toBe(true)

    // Lancé : plus rien en poche, le sort reste découvert.
    await db.delete(pocketSpells)
    await db.insert(activeEffects).values({
      userId,
      casterId: userId,
      spell: 'VITALITY',
      face: 'boon',
      castAt: new Date(),
      castCooldownStartedAt: new Date(),
    })
    expect(await read()).toBe(true)
  })

  it('dit les leçons de Michel déjà vues', async () => {
    const userId = await createPlayer(db, { discordId: 'eleve', username: 'eleve' })
    const read = async (): Promise<string[]> =>
      (await (await state(apiRequest('http://test/state', await sessionCookieFor(userId)))).json()).lessonsDone

    expect(await read()).toEqual([])

    await db.update(users).set({ campLessonAt: new Date() }).where(eq(users.id, userId))
    expect(await read()).toEqual(['camp'])
  })

  it('sert une question sur action du joueur, puis son verdict', async () => {
    const served = await (await next(post('/next', {}, cookie))).json()
    expect(served.question).toMatchObject({ statement: 'Capitale de la Gironde ?' })

    const verdict = await (await answer(post('/answer', { answer: 'Bordeaux' }, cookie))).json()

    expect(verdict.verdict).toMatchObject({ correct: true, lifeLost: false })
    expect(verdict.question).toBeNull()
    // Une question vue : le Volumen a de quoi se lire, le camp pose son parchemin.
    expect(verdict.seenTotal).toBe(1)
  })

  it('tient une réponse faite d espaces pour une réponse vide', async () => {
    // Une seule vie : la réponse ratée mène au camp, seul endroit d'où le pool
    // se relit. Une deuxième question garde l'étage ouvert.
    await createQuestion(db, { statement: 'Capitale de la Corse ?', accepted: ['Ajaccio'] })
    cookie = await sessionCookieFor(await createPlayer(db, { discordId: '987654321', lives: 1 }))
    await next(post('/next', {}, cookie))

    const verdict = await (await answer(post('/answer', { answer: '   ' }, cookie))).json()

    expect(verdict.verdict).toMatchObject({ correct: false })
    expect(verdict.unlocked).toContain('EMPTY_ANSWER')

    // Ratée, donc au Pool Échecs — mais pas contestable, comme le vide.
    const missed = await (await log(apiRequest('http://test/question-log?filter=missed', cookie))).json()
    expect(missed.total).toBe(1)
    const open = await (await disputable(apiRequest('http://test/disputable-errors', cookie))).json()
    expect(open.errors).toEqual([])
  })

  it('rejette un corps de réponse sans champ answer', async () => {
    await next(post('/next', {}, cookie))

    const response = await answer(post('/answer', {}, cookie))

    expect(response.status).toBe(400)
  })

  // Le verdict réaffiche la saisie, dans un cadre qui ne défile pas.
  it('rejette une réponse de plus de 60 caractères', async () => {
    await next(post('/next', {}, cookie))

    const response = await answer(post('/answer', { answer: 'a'.repeat(61) }, cookie))

    expect(response.status).toBe(400)
  })

  it('ouvre le coffre par son propre endpoint, sans rien avancer d autre', async () => {
    // Sans coffre à ouvrir, l'appel est ignoré : il rend l'état courant, comme
    // toute action périmée. Voir specs/architecture.md.
    await next(post('/next', {}, cookie))

    const body = await (await chest(post('/chest', {}, cookie))).json()

    expect(body.chest).toBeNull()
    expect(body.question).not.toBeNull()
  })

  it('répond 404 sur une route d API inconnue, sans rediriger', async () => {
    // L'attrape-tout des pages ramène au jeu ; une API, elle, doit dire non —
    // aucun client ne sait lire une redirection vers du HTML.
    const response = await unknown(apiRequest('http://test/api/nimportequoi'))

    expect(response.status).toBe(404)
  })
})
