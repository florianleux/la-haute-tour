import { beforeEach, describe, expect, it } from 'vitest'
import { setDatabase } from '../../server/db/client'
import { disputes, missedPool, recoveryQuestions, reservations } from '../../server/db/schema'
import { createPlayer, createQuestion, createTestDatabase, markSeen } from '../helpers/db'
import { apiRequest, installNitroGlobals, mountHandler, sessionCookieFor } from '../helpers/nitro'
import type { Database } from '../../server/db/client'

installNitroGlobals()

const { default: logHandler } = await import('../../server/api/game/question-log.get')

const log = mountHandler('/question-log', logHandler)

/** Au camp : l'attente court. C'est là, et là seulement, que le Volumen s'ouvre. */
const AT_CAMP = { lives: 0, cooldownUntil: new Date(Date.now() + 60_000) }

/** Une heure fixe, décalée de `seconds` : l'ordre des vues se lit sans ambiguïté. */
function at(seconds: number): Date {
  return new Date(Date.UTC(2026, 0, 1) + seconds * 1_000)
}

describe('Volumen', () => {
  let db: Database

  beforeEach(async () => {
    db = await createTestDatabase()
    setDatabase(db)
    // Une question pas encore vue sur chaque étage joué : un étage tout vu
    // serait le palier, pas le camp.
    await createQuestion(db, { statement: 'Pas encore vue', floor: 1 })
    await createQuestion(db, { statement: 'Pas encore vue', floor: 2 })
  })

  /** Une question ratée qui est encore au Pool Échecs de l'étage du joueur. */
  async function miss(userId: number, statement: string, failedAt: Date, poolSuccesses = 0): Promise<string> {
    const questionId = await createQuestion(db, { statement })
    await markSeen(db, userId, questionId, { correct: false, submittedAnswer: 'Lyon', seenAt: failedAt })
    await db.insert(missedPool).values({ userId, questionId, floor: 1, poolSuccesses, lastFailedAt: failedAt })
    return questionId
  }

  describe('la garde du camp', () => {
    it('ferme le Volumen en pleine ascension', async () => {
      const userId = await createPlayer(db)
      const questionId = await createQuestion(db)
      await db.insert(reservations).values({ userId, questionId, mode: 'ascent', expiresAt: new Date(Date.now() + 60_000) })
      const cookie = await sessionCookieFor(userId)

      expect((await log(apiRequest('http://test/question-log?filter=missed', cookie))).status).toBe(403)
      expect((await log(apiRequest('http://test/question-log', cookie))).status).toBe(403)
    })

    // Le rattrapage tire dans le pool : en lire les réponses pendant qu'il
    // tourne serait tricher. Voir specs/ecrans.md#volumen.
    it('les ferme dès que le rattrapage est tiré', async () => {
      const userId = await createPlayer(db, { lives: 0, cooldownUntil: new Date(Date.now() - 60_000) })
      const questionId = await miss(userId, 'Q', at(0))
      await db.insert(recoveryQuestions).values({ userId, questionId, position: 0 })
      const cookie = await sessionCookieFor(userId)

      expect((await log(apiRequest('http://test/question-log?filter=missed', cookie))).status).toBe(403)
      expect((await log(apiRequest('http://test/question-log', cookie))).status).toBe(403)
    })

    it('les laisse ouvertes après l attente, tant que le rattrapage n est pas tiré', async () => {
      const cookie = await sessionCookieFor(await createPlayer(db, { lives: 0, cooldownUntil: new Date(Date.now() - 60_000) }))

      expect((await log(apiRequest('http://test/question-log?filter=missed', cookie))).status).toBe(200)
      expect((await log(apiRequest('http://test/question-log', cookie))).status).toBe(200)
    })
  })

  describe('l onglet À revoir', () => {
    it('sert le pool vingt par page, dernier échec en tête, avec le seuil de sortie', async () => {
      const userId = await createPlayer(db, AT_CAMP)
      for (let index = 1; index <= 21; index++) {
        await miss(userId, `Q${index}`, at(index))
      }
      const cookie = await sessionCookieFor(userId)

      const first = await (await log(apiRequest('http://test/question-log?filter=missed', cookie))).json()
      const second = await (await log(apiRequest('http://test/question-log?filter=missed&page=2', cookie))).json()

      expect(first.total).toBe(21)
      expect(first.poolSuccessesToLeave).toBe(2)
      expect(first.entries).toHaveLength(20)
      expect(first.entries[0].statement).toBe('Q21')
      expect(second.entries.map((entry: { statement: string }) => entry.statement)).toEqual(['Q1'])
    })

    it('rejette une page qui n existe pas plutôt que d en inventer une', async () => {
      const cookie = await sessionCookieFor(await createPlayer(db, AT_CAMP))

      expect((await log(apiRequest('http://test/question-log?filter=missed&page=0', cookie))).status).toBe(400)
    })
  })

  describe('les onglets Connues et Toutes', () => {
    it('montre toutes les vues, tous étages, la plus récente en tête', async () => {
      const userId = await createPlayer(db, { ...AT_CAMP, currentFloor: 2 })
      const lower = await createQuestion(db, { statement: 'Étage 1', floor: 1 })
      await markSeen(db, userId, lower, { floor: 1, correct: true, submittedAnswer: 'Bordeaux', seenAt: at(1) })
      const upper = await createQuestion(db, { statement: 'Étage 2', floor: 2 })
      await markSeen(db, userId, upper, { floor: 2, correct: false, submittedAnswer: 'Lyon', seenAt: at(2) })

      const body = await (await log(apiRequest('http://test/question-log?filter=all', await sessionCookieFor(userId)))).json()

      expect(body.total).toBe(2)
      expect(body.entries).toEqual([
        expect.objectContaining({ statement: 'Étage 2', correct: false, submittedAnswer: 'Lyon', answerLabel: 'BORDEAUX' }),
        expect.objectContaining({ statement: 'Étage 1', correct: true, submittedAnswer: 'Bordeaux' }),
      ])
    })

    it('ne garde que les justes dans Connues', async () => {
      const userId = await createPlayer(db, AT_CAMP)
      const right = await createQuestion(db, { statement: 'Juste' })
      await markSeen(db, userId, right, { correct: true, seenAt: at(1) })
      await miss(userId, 'Fausse', at(2))

      const body = await (await log(apiRequest('http://test/question-log?filter=correct', await sessionCookieFor(userId)))).json()

      expect(body.total).toBe(1)
      expect(body.entries.map((entry: { statement: string }) => entry.statement)).toEqual(['Juste'])
    })

    it('porte le progrès de rattrapage et la contestation des questions encore au pool', async () => {
      const userId = await createPlayer(db, AT_CAMP)
      const right = await createQuestion(db, { statement: 'Juste' })
      await markSeen(db, userId, right, { correct: true, seenAt: at(1) })
      const missed = await miss(userId, 'Fausse', at(2), 1)
      await db.insert(disputes).values({ userId, questionId: missed })

      const body = await (await log(apiRequest('http://test/question-log', await sessionCookieFor(userId)))).json()

      expect(body.poolSuccessesToLeave).toBe(2)
      expect(body.entries).toEqual([
        expect.objectContaining({ statement: 'Fausse', poolSuccesses: 1, disputeStatus: 'pending' }),
        expect.objectContaining({ statement: 'Juste', poolSuccesses: null, disputeStatus: 'none' }),
      ])
    })

    it('pagine par vingt', async () => {
      const userId = await createPlayer(db, AT_CAMP)
      for (let index = 1; index <= 21; index++) {
        await markSeen(db, userId, await createQuestion(db, { statement: `Q${index}` }), { seenAt: at(index) })
      }
      const cookie = await sessionCookieFor(userId)

      const first = await (await log(apiRequest('http://test/question-log', cookie))).json()
      const second = await (await log(apiRequest('http://test/question-log?page=2', cookie))).json()

      expect(first.total).toBe(21)
      expect(first.entries).toHaveLength(20)
      expect(second.entries.map((entry: { statement: string }) => entry.statement)).toEqual(['Q1'])
      // Compté une fois, en page 1 : l'écran garde le total.
      expect(second.total).toBeNull()
    })

    it('rejette un filtre inconnu', async () => {
      const cookie = await sessionCookieFor(await createPlayer(db, AT_CAMP))

      expect((await log(apiRequest('http://test/question-log?filter=fausses', cookie))).status).toBe(400)
    })
  })
})
