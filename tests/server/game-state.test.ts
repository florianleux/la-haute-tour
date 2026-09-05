import { beforeEach, describe, expect, it } from 'vitest'
import { setDatabase } from '../../server/db/client'
import { createPlayer, createQuestion, createTestDatabase } from '../helpers/db'
import { apiRequest, installNitroGlobals, mountHandler, sessionCookieFor } from '../helpers/nitro'
import type { Database } from '../../server/db/client'

installNitroGlobals()

const { default: stateHandler } = await import('../../server/api/game/state.get')
const { default: nextHandler } = await import('../../server/api/game/next.post')
const { default: answerHandler } = await import('../../server/api/game/answer.post')
const { default: poolHandler } = await import('../../server/api/game/pool.get')
const { default: chestHandler } = await import('../../server/api/game/chest.post')

const state = mountHandler('/state', stateHandler)
const next = mountHandler('/next', nextHandler)
const answer = mountHandler('/answer', answerHandler)
const pool = mountHandler('/pool', poolHandler)
const chest = mountHandler('/chest', chestHandler)

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
    expect((await pool(apiRequest('http://test/pool'))).status).toBe(401)
    expect((await chest(post('/chest', {}))).status).toBe(401)
  })

  it('rend l état courant sans rien réserver', async () => {
    const response = await state(apiRequest('http://test/state', cookie))

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      phase: 'ascent',
      floor: 1,
      lives: 3,
      started: false,
      question: null,
      verdict: null,
    })
  })

  it('sert une question sur action du joueur, puis son verdict', async () => {
    const served = await (await next(post('/next', {}, cookie))).json()
    expect(served.question).toMatchObject({ statement: 'Capitale de la Gironde ?' })

    const verdict = await (await answer(post('/answer', { answer: 'Bordeaux' }, cookie))).json()

    expect(verdict.verdict).toMatchObject({ correct: true, lifeLost: false })
    expect(verdict.question).toBeNull()
  })

  it('rejette un corps de réponse sans champ answer', async () => {
    await next(post('/next', {}, cookie))

    const response = await answer(post('/answer', {}, cookie))

    expect(response.status).toBe(400)
  })

  it('sert le Pool Échecs, page par page et trié', async () => {
    const response = await pool(apiRequest('http://test/pool?offset=0&order=asc', cookie))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ entries: [], total: 0 })
  })

  it('rejette un tri inconnu plutôt que d en inventer un', async () => {
    const response = await pool(apiRequest('http://test/pool?order=aleatoire', cookie))

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
})
