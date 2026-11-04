import { and, eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { setDatabase } from '../../server/db/client'
import { categories, disputes, missedPool, questionCategories, recoveryQuestions, reservations, seenQuestions } from '../../server/db/schema'
import { createPlayer, createQuestion, createTestDatabase, grantLeechNet, grantQuill, markSeen } from '../helpers/db'
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

  describe('l onglet Sangsues', () => {
    /** Une question vue, ratée `failures` fois au rattrapage. */
    async function leech(userId: number, statement: string, seenAt: Date, failures: number): Promise<string> {
      const questionId = await createQuestion(db, { statement })
      await markSeen(db, userId, questionId, { floor: 1, correct: false, submittedAnswer: 'Lyon', seenAt })
      await db
        .update(seenQuestions)
        .set({ recoveryFailures: failures })
        .where(and(eq(seenQuestions.userId, userId), eq(seenQuestions.questionId, questionId)))
      return questionId
    }

    const read = (cookie: string): Promise<Response> => log(apiRequest('http://test/question-log?filter=leeches', cookie))

    it('refuse qui n a pas le Filet à sangsues', async () => {
      const userId = await createPlayer(db, AT_CAMP)

      expect((await read(await sessionCookieFor(userId))).status).toBe(403)
    })

    it('ne dit les échecs d une Sangsue qu à qui porte le Filet, dans tous les onglets', async () => {
      const userId = await createPlayer(db, AT_CAMP)
      await leech(userId, 'Coriace', at(0), 5)
      await leech(userId, 'Sous le seuil', at(1), 2)
      const failures = async (): Promise<(number | null)[]> => {
        const response = await log(apiRequest('http://test/question-log?filter=all', await sessionCookieFor(userId)))
        const { entries } = await response.json()
        return entries.map((entry: { leechFailures: number | null }) => entry.leechFailures)
      }

      expect(await failures()).toEqual([null, null])

      await grantLeechNet(db, userId)

      expect(await failures()).toEqual([null, 5])
    })

    it('montre les questions au seuil, les plus ratées d abord, puis les plus récentes', async () => {
      const userId = await createPlayer(db, AT_CAMP)
      await grantLeechNet(db, userId)
      await leech(userId, 'Sous le seuil', at(9), 2)
      await leech(userId, 'Ancienne', at(1), 3)
      await leech(userId, 'Récente', at(2), 3)
      await leech(userId, 'Coriace', at(0), 5)

      const body = await (await read(await sessionCookieFor(userId))).json()

      expect(body.entries.map((entry: { statement: string }) => entry.statement)).toEqual(['Coriace', 'Récente', 'Ancienne'])
      expect(body.entries[0].leechFailures).toBe(5)
      expect(body.total).toBe(3)
    })

    it('garde une Sangsue sortie du pool et celles des autres étages, pas celles des autres joueurs', async () => {
      const userId = await createPlayer(db, { ...AT_CAMP, currentFloor: 2 })
      const other = await createPlayer(db, { discordId: 'autre', username: 'autre' })
      await grantLeechNet(db, userId)
      await leech(userId, 'Étage 1', at(0), 3)
      await leech(other, 'À un autre', at(1), 3)

      const body = await (await read(await sessionCookieFor(userId))).json()

      expect(body.entries.map((entry: { statement: string }) => entry.statement)).toEqual(['Étage 1'])
    })
  })

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

  describe('la recherche et la catégorie', () => {
    it('filtre les trois onglets, et leur total, sur le texte et sur la catégorie', async () => {
      const userId = await createPlayer(db, AT_CAMP)
      await grantQuill(db, userId)
      const cookie = await sessionCookieFor(userId)
      const [{ id: categoryId }] = await db.insert(categories).values({ name: 'SPORT' }).returning()

      const sport = await miss(userId, 'Qui a gagné la Coupe 98 ?', at(1))
      await db.insert(questionCategories).values({ questionId: sport, categoryId })
      await miss(userId, 'Capitale de l Italie ?', at(2))

      const statements = async (query: string): Promise<string[]> => {
        const body = await (await log(apiRequest(`http://test/question-log?${query}`, cookie))).json()
        return body.entries.map((entry: { statement: string }) => entry.statement)
      }

      for (const filter of ['missed', 'all']) {
        expect(await statements(`filter=${filter}&q=coupe`)).toEqual(['Qui a gagné la Coupe 98 ?'])
        expect(await statements(`filter=${filter}&category=SPORT`)).toEqual(['Qui a gagné la Coupe 98 ?'])
        expect(await statements(`filter=${filter}&q=italie&category=SPORT`)).toEqual([])
      }

      // Les jokers de LIKE se cherchent tels quels.
      expect(await statements('filter=all&q=%25')).toEqual([])
      const total = (await (await log(apiRequest('http://test/question-log?filter=all&q=coupe', cookie))).json()).total
      expect(total).toBe(1)
      // Le code d'une catégorie inconnue est une erreur, pas une liste vide.
      expect((await log(apiRequest('http://test/question-log?category=NOPE', cookie))).status).toBe(400)
    })
  })

  describe('sans la Plume de copiste', () => {
    it('refuse la recherche et la catégorie, mais lit le journal', async () => {
      const cookie = await sessionCookieFor(await createPlayer(db, AT_CAMP))

      expect((await log(apiRequest('http://test/question-log?q=coupe', cookie))).status).toBe(403)
      expect((await log(apiRequest('http://test/question-log?category=SPORT', cookie))).status).toBe(403)
      expect((await log(apiRequest('http://test/question-log', cookie))).status).toBe(200)
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
