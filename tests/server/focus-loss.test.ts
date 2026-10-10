import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { focusLosses, missedPool, seenQuestions, users } from '../../server/db/schema'
import { disputableErrors } from '../../server/utils/disputes'
import { serveNextQuestion, submitAnswer } from '../../server/utils/game'
import { resetPlayer } from '../../server/utils/players'
import { rulesForFloor } from '../../server/utils/rules'
import { createPlayer, createQuestion, createTestDatabase, loadPlayer, markSeen } from '../helpers/db'
import { installNitroGlobals } from '../helpers/nitro'
import type { Database } from '../../server/db/client'
import type { User } from '../../server/db/schema'

installNitroGlobals()

const NOW = new Date('2026-09-03T12:00:00.000Z')
const rules = rulesForFloor(1)

describe('perte de focus', () => {
  let db: Database
  let player: User

  beforeEach(async () => {
    db = await createTestDatabase()
    const id = await createPlayer(db)
    player = await loadPlayer(db, id)
    await createQuestion(db, { statement: 'Capitale de la Gironde ?', accepted: ['Bordeaux'] })
    await createQuestion(db, { statement: 'Autre ?', accepted: ['Bordeaux'] })
  })

  const reload = (): Promise<User> => loadPlayer(db, player.id)

  /** Sert une question et la résout par un départ de page. */
  async function leaveThePage(answer: string): Promise<string> {
    const served = await serveNextQuestion(db, await reload(), NOW)
    await submitAnswer(db, await reload(), answer, new Date(NOW.getTime() + 2_000), 'focusLoss')

    return served.question?.id ?? ''
  }

  it('sert la tolérance avec la question : la règle vit côté serveur', async () => {
    const state = await serveNextQuestion(db, player, NOW)

    expect(state.question?.focusGraceMs).toBe(rules.focusGraceMs)
  })

  it('soumet la réponse en l état : un champ vide est une erreur ordinaire', async () => {
    const questionId = await leaveThePage('')

    const state = await submitAnswer(db, await reload(), '', new Date(NOW.getTime() + 3_000))
    expect(state.verdict).toMatchObject({ questionId, correct: false, lifeLost: true })
    expect((await reload()).lives).toBe(rules.lives - 1)
    expect(await db.select().from(missedPool)).toHaveLength(1)
  })

  it('valide une bonne réponse déjà saisie : la sanction est de perdre la main', async () => {
    await leaveThePage('Bordeaux')

    const [seen] = await db.select().from(seenQuestions)
    expect(seen.correct).toBe(true)
    expect((await reload()).lives).toBe(rules.lives)
  })

  it('enregistre un flag, avec la phase qui servait la question', async () => {
    const questionId = await leaveThePage('')

    expect(await db.select().from(focusLosses)).toMatchObject([
      { userId: player.id, questionId, mode: 'ascent', lostAt: new Date(NOW.getTime() + 2_000) },
    ])
  })

  it('n enregistre rien quand le joueur répond lui-même', async () => {
    await serveNextQuestion(db, player, NOW)
    await submitAnswer(db, await reload(), 'Bordeaux', new Date(NOW.getTime() + 2_000))

    expect(await db.select().from(focusLosses)).toHaveLength(0)
  })

  it('compte la question fausse en rattrapage et remet son compteur à zéro', async () => {
    // Un pool assez fourni, chaque question à une réussite de la sortie.
    for (let i = 0; i < rules.poolSizeForRecovery; i++) {
      const questionId = await createQuestion(db, { statement: `Ratée ${i} ?`, accepted: ['Bordeaux'] })
      await markSeen(db, player.id, questionId, { floor: 1, correct: false, submittedAnswer: 'nawak', seenAt: NOW })
      await db.insert(missedPool).values({
        userId: player.id,
        questionId,
        floor: 1,
        poolSuccesses: 1,
        lastFailedAt: NOW,
      })
    }
    await db.update(users).set({ lives: 0, cooldownUntil: NOW }).where(eq(users.id, player.id))

    const served = await serveNextQuestion(db, await reload(), NOW)
    const questionId = served.question?.id ?? ''
    // La bonne réponse est dans le champ : en rattrapage, partir compte faux
    // quand même — il n'y a pas de vie à prendre à la place.
    await submitAnswer(db, await reload(), 'Bordeaux', new Date(NOW.getTime() + 2_000), 'focusLoss')

    const [entry] = await db.select().from(missedPool).where(eq(missedPool.questionId, questionId))
    expect(entry.poolSuccesses).toBe(0)
    expect(await db.select().from(focusLosses)).toMatchObject([{ mode: 'recovery' }])
  })

  it('n est pas contestable : ce motif ne s arbitre pas', async () => {
    // Une réponse fausse : « Bordo » passerait pour juste, et il n'y aurait
    // alors rien à contester de toute façon.
    await leaveThePage('Lyon')

    expect(await disputableErrors(db, await reload())).toEqual([])
  })

  // Un échec de rattrapage ne change pas la réponse qu'on contesterait : celle
  // que le départ de page a soumise reste écartée.
  it('reste non contestable après un échec de rattrapage sur la même question', async () => {
    const questionId = await leaveThePage('Lyon')
    await db
      .update(missedPool)
      .set({ lastFailedAt: new Date(NOW.getTime() + 60_000) })
      .where(eq(missedPool.questionId, questionId))

    expect(await disputableErrors(db, await reload())).toEqual([])
  })

  // L'inverse : un départ de page en rattrapage ne soumet pas la réponse qu'on
  // conteste, celle tapée en ascension reste contestable.
  it('laisse contester l échec d ascension malgré un départ de page en rattrapage', async () => {
    const served = await serveNextQuestion(db, await reload(), NOW)
    const questionId = served.question!.id
    await submitAnswer(db, await reload(), 'Lyon', new Date(NOW.getTime() + 2_000))
    await db.insert(focusLosses).values({
      userId: player.id,
      questionId,
      mode: 'recovery',
      lostAt: new Date(NOW.getTime() + 60_000),
    })

    expect(await disputableErrors(db, await reload())).toMatchObject([{ questionId }])
  })

  // Ce qui ne se conteste pas, c'est la réponse soumise par le départ de page —
  // pas la question : vue de nouveau après une remise à zéro, qui garde les
  // pertes de focus, et ratée sur une vraie réponse, elle se conteste comme une
  // autre. Voir specs/validation.md#quand.
  it('laisse contester la question ratée sur une vraie réponse après une remise à zéro', async () => {
    const questionId = await leaveThePage('Lyon')
    await resetPlayer(db, await reload(), NOW)

    const later = new Date(NOW.getTime() + 60_000)
    const served = await serveNextQuestion(db, await reload(), later)
    expect(served.question?.id).toBe(questionId)
    await submitAnswer(db, await reload(), 'Lyon', new Date(later.getTime() + 2_000))

    expect(await disputableErrors(db, await reload())).toMatchObject([{ questionId }])
  })
})
