import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { setDatabase } from '../../server/db/client'
import { acceptedAnswers, missedPool, questions, seenQuestions } from '../../server/db/schema'
import { createPlayer, createQuestion, createTestDatabase } from '../helpers/db'
import {
  apiRequest,
  installNitroGlobals,
  jsonRequest,
  mountHandler,
  mountRoute,
  sessionCookieFor,
} from '../helpers/nitro'
import type { Database } from '../../server/db/client'

installNitroGlobals()

const { default: listHandler } = await import('../../server/api/admin/questions/index.get')
const { default: createHandler } = await import('../../server/api/admin/questions/index.post')
const { default: editHandler } = await import('../../server/api/admin/questions/[id].put')
const { default: deleteHandler } = await import('../../server/api/admin/questions/[id].delete')

const list = mountHandler('/questions', listHandler)
const create = mountHandler('/questions', createHandler)
const edit = mountRoute('put', '/questions/:id', editHandler)
const remove = mountRoute('delete', '/questions/:id', deleteHandler)

const DRAFT = {
  statement: 'Qui a découvert la pénicilline ?',
  answerLabel: 'FLEMING (Alexander)',
  floor: 3,
  acceptedAnswers: ['Fleming', 'Alexander Fleming'],
}

describe('questions admin', () => {
  let db: Database
  let adminCookie: string

  beforeEach(async () => {
    db = await createTestDatabase()
    setDatabase(db)
    adminCookie = await sessionCookieFor(await createPlayer(db, { isAdmin: true }))
  })

  async function playerCookie(): Promise<string> {
    const id = await createPlayer(db, { discordId: '987654321', username: 'frodo' })
    return sessionCookieFor(id)
  }

  async function createOne(body: unknown = DRAFT): Promise<Response> {
    return create(jsonRequest('http://test/questions', 'POST', body, adminCookie))
  }

  describe('garde admin', () => {
    it('refuse la lecture sans session', async () => {
      expect((await list(apiRequest('http://test/questions'))).status).toBe(401)
    })

    it('refuse tout à un joueur sans le flag admin', async () => {
      const cookie = await playerCookie()
      const id = await createQuestion(db)

      expect((await list(apiRequest('http://test/questions', cookie))).status).toBe(403)
      expect((await create(jsonRequest('http://test/questions', 'POST', DRAFT, cookie))).status)
        .toBe(403)
      expect((await edit(jsonRequest(`http://test/questions/${id}`, 'PUT', DRAFT, cookie))).status)
        .toBe(403)
      expect((await remove(jsonRequest(`http://test/questions/${id}`, 'DELETE', undefined, cookie))).status)
        .toBe(403)
      expect(await db.select().from(questions)).toHaveLength(1)
    })
  })

  describe('liste', () => {
    it('rend les questions avec leurs réponses acceptées', async () => {
      const id = await createQuestion(db, {
        statement: 'Capitale de la Gironde ?',
        answerLabel: 'BORDEAUX',
        floor: 1,
        accepted: ['Bordeaux', 'bordeaux (33)'],
      })

      const response = await list(apiRequest('http://test/questions', adminCookie))

      expect(response.status).toBe(200)
      const { questions: listed } = await response.json()
      expect(listed).toEqual([{
        id,
        statement: 'Capitale de la Gironde ?',
        answerLabel: 'BORDEAUX',
        floor: 1,
        acceptedAnswers: ['Bordeaux', 'bordeaux (33)'],
      }])
    })

    it('filtre par étage', async () => {
      await createQuestion(db, { statement: 'Étage 1 ?', floor: 1 })
      const wanted = await createQuestion(db, { statement: 'Étage 4 ?', floor: 4 })

      const response = await list(apiRequest('http://test/questions?floor=4', adminCookie))

      const { questions: listed } = await response.json()
      expect(listed.map((question: { id: string }) => question.id)).toEqual([wanted])
    })

    it('rend le total au-dessus du filtre', async () => {
      await createQuestion(db, { statement: 'Une ?', floor: 1 })
      await createQuestion(db, { statement: 'Deux ?', floor: 2 })

      const response = await list(apiRequest('http://test/questions?floor=1', adminCookie))

      const body = await response.json()
      expect(body.questions).toHaveLength(1)
      expect(body.total).toBe(1)
    })

    it('pagine par dix', async () => {
      for (let i = 0; i < 12; i++) {
        await createQuestion(db, { statement: `Question ${i} ?`, floor: 1 })
      }

      const first = await list(apiRequest('http://test/questions?page=1', adminCookie))
      const second = await list(apiRequest('http://test/questions?page=2', adminCookie))

      const firstBody = await first.json()
      const secondBody = await second.json()
      expect(firstBody.questions).toHaveLength(10)
      expect(firstBody.total).toBe(12)
      expect(secondBody.questions).toHaveLength(2)
      expect(secondBody.total).toBe(12)
    })

    it('ne se chevauche pas entre les pages', async () => {
      for (let i = 0; i < 15; i++) {
        await createQuestion(db, { statement: `Question ${i} ?`, floor: 1 })
      }

      const first = await (await list(apiRequest('http://test/questions?page=1', adminCookie))).json()
      const second = await (await list(apiRequest('http://test/questions?page=2', adminCookie))).json()

      const firstIds = new Set(first.questions.map((q: { id: string }) => q.id))
      for (const q of second.questions) {
        expect(firstIds.has(q.id)).toBe(false)
      }
      expect(first.questions.length + second.questions.length).toBe(15)
    })

    it('cherche par fragment d énoncé, insensible à la casse', async () => {
      await createQuestion(db, { statement: 'Capitale de la Gironde ?', floor: 1 })
      await createQuestion(db, { statement: 'Capitale de la Vendée ?', floor: 1 })
      await createQuestion(db, { statement: 'Préfecture du Finistère ?', floor: 1 })

      const response = await list(apiRequest('http://test/questions?search=capitale', adminCookie))

      const body = await response.json()
      expect(body.questions).toHaveLength(2)
      expect(body.total).toBe(2)
    })

    it('combines filtre d étage et recherche', async () => {
      await createQuestion(db, { statement: 'Capitale de la Gironde ?', floor: 1 })
      await createQuestion(db, { statement: 'Capitale de la Vendée ?', floor: 2 })

      const response = await list(apiRequest('http://test/questions?floor=1&search=capitale', adminCookie))

      const body = await response.json()
      expect(body.questions).toHaveLength(1)
      expect(body.total).toBe(1)
    })

    it('rejette un étage qui n existe pas', async () => {
      const response = await list(apiRequest('http://test/questions?floor=9', adminCookie))

      expect(response.status).toBe(400)
    })
  })

  describe('création', () => {
    it('crée une question sur un étage, avec ses réponses acceptées', async () => {
      const response = await createOne()

      expect(response.status).toBe(200)
      expect(await response.json()).toMatchObject({
        statement: DRAFT.statement,
        answerLabel: DRAFT.answerLabel,
        floor: 3,
        acceptedAnswers: DRAFT.acceptedAnswers,
      })
      expect(await db.select().from(acceptedAnswers)).toHaveLength(2)
    })

    it('rejette un étage hors de la tour', async () => {
      expect((await createOne({ ...DRAFT, floor: 0 })).status).toBe(400)
      expect((await createOne({ ...DRAFT, floor: 7 })).status).toBe(400)
      expect(await db.select().from(questions)).toHaveLength(0)
    })

    it('rejette un énoncé vide', async () => {
      expect((await createOne({ ...DRAFT, statement: '   ' })).status).toBe(400)
    })

    it('rejette une question sans aucune réponse acceptée : elle serait imbattable', async () => {
      expect((await createOne({ ...DRAFT, acceptedAnswers: [] })).status).toBe(400)
      expect((await createOne({ ...DRAFT, acceptedAnswers: ['  '] })).status).toBe(400)
      expect(await db.select().from(questions)).toHaveLength(0)
    })
  })

  describe('édition', () => {
    it('remplace l énoncé, la réponse affichée et les réponses acceptées', async () => {
      const id = await createQuestion(db, { accepted: ['Bordeaux'] })

      const response = await edit(jsonRequest(`http://test/questions/${id}`, 'PUT', {
        statement: 'Préfecture de la Gironde ?',
        answerLabel: 'BORDEAUX (Gironde)',
        acceptedAnswers: ['Bordeaux', 'Bordeaux 33'],
      }, adminCookie))

      expect(response.status).toBe(200)
      expect(await response.json()).toMatchObject({
        id,
        statement: 'Préfecture de la Gironde ?',
        answerLabel: 'BORDEAUX (Gironde)',
        acceptedAnswers: ['Bordeaux', 'Bordeaux 33'],
      })
      expect(await db.select().from(acceptedAnswers)).toHaveLength(2)
    })

    it('laisse l étage tranquille : la répartition appartient au script d import', async () => {
      const id = await createQuestion(db, { floor: 2 })

      await edit(jsonRequest(`http://test/questions/${id}`, 'PUT', {
        ...DRAFT,
        floor: 5,
      }, adminCookie))

      const [question] = await db.select().from(questions).where(eq(questions.id, id))
      expect(question.floor).toBe(2)
    })

    it('répond 404 sur une question qui n existe pas', async () => {
      const response = await edit(jsonRequest('http://test/questions/inconnue', 'PUT', {
        statement: 'Peu importe ?',
        answerLabel: 'RIEN',
        acceptedAnswers: ['rien'],
      }, adminCookie))

      expect(response.status).toBe(404)
    })
  })

  describe('suppression', () => {
    it('supprime la question et ses réponses acceptées', async () => {
      const id = await createQuestion(db, { accepted: ['Bordeaux', 'bordeaux'] })

      const response = await remove(jsonRequest(`http://test/questions/${id}`, 'DELETE', undefined, adminCookie))

      expect(response.status).toBe(200)
      expect(await db.select().from(questions)).toHaveLength(0)
      expect(await db.select().from(acceptedAnswers)).toHaveLength(0)
    })

    it('répond 404 sur une question qui n existe pas', async () => {
      const response = await remove(
        jsonRequest('http://test/questions/inconnue', 'DELETE', undefined, adminCookie),
      )

      expect(response.status).toBe(404)
    })

    it('laisse la progression des joueurs cohérente : une vue de moins, une question de moins', async () => {
      const playerId = await createPlayer(db, { discordId: '111', username: 'frodo' })
      const id = await createQuestion(db)
      await createQuestion(db, { statement: 'Celle qui reste ?' })
      await db.insert(seenQuestions).values({ userId: playerId, questionId: id, floor: 1, correct: false })
      await db.insert(missedPool).values({
        userId: playerId,
        questionId: id,
        floor: 1,
        lastFailedAt: new Date('2026-09-03T12:00:00.000Z'),
      })

      await remove(jsonRequest(`http://test/questions/${id}`, 'DELETE', undefined, adminCookie))

      // L'étage perd une question et une question vue : le joueur n'avance ni ne
      // recule, et la question quittée ne traîne plus dans son Pool Échecs.
      expect(await db.select().from(seenQuestions)).toHaveLength(0)
      expect(await db.select().from(missedPool)).toHaveLength(0)
      expect(await db.select().from(questions)).toHaveLength(1)
    })
  })
})
