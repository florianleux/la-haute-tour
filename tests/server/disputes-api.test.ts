import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { setDatabase } from '../../server/db/client'
import { disputes, missedPool, users } from '../../server/db/schema'
import { createPlayer, createQuestion, createTestDatabase, loadPlayer, markSeen } from '../helpers/db'
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

const { default: disputableHandler } = await import('../../server/api/game/disputable-errors.get')
const { default: openHandler } = await import('../../server/api/game/disputes.post')
const { default: queueHandler } = await import('../../server/api/admin/disputes/index.get')
const { default: settleHandler } = await import('../../server/api/admin/disputes/[id].put')

const disputable = mountHandler('/disputable-errors', disputableHandler)
const open = mountHandler('/disputes', openHandler)
const queue = mountHandler('/disputes', queueHandler)
const settle = mountRoute('put', '/disputes/:id', settleHandler)

const NOW = new Date('2026-09-03T12:00:00.000Z')

describe('contestation par l API', () => {
  let db: Database
  let playerId: number
  let playerCookie: string
  let adminCookie: string
  let questionId: string

  beforeEach(async () => {
    db = await createTestDatabase()
    setDatabase(db)

    playerId = await createPlayer(db)
    playerCookie = await sessionCookieFor(playerId)
    adminCookie = await sessionCookieFor(
      await createPlayer(db, { discordId: '999', username: 'saruman', isAdmin: true }),
    )

    questionId = await createQuestion(db, { accepted: ['Bordeaux'] })
    await markSeen(db, playerId, questionId, { floor: 1, correct: false, submittedAnswer: 'Bordo', seenAt: NOW })
    await db.insert(missedPool).values({
      userId: playerId,
      questionId,
      floor: 1,
      lastFailedAt: NOW,
    })
  })

  async function openOne(): Promise<Response> {
    return open(jsonRequest('http://test/disputes', 'POST', { questionId }, playerCookie))
  }

  it('refuse tout à un visiteur sans session', async () => {
    expect((await disputable(apiRequest('http://test/disputable-errors'))).status).toBe(401)
    expect((await open(jsonRequest('http://test/disputes', 'POST', { questionId }))).status).toBe(401)
  })

  it('réserve la file et l arbitrage au flag admin', async () => {
    expect((await queue(apiRequest('http://test/disputes', playerCookie))).status).toBe(403)
    expect((await settle(
      jsonRequest('http://test/disputes/1', 'PUT', { verdict: 'accepted' }, playerCookie),
    )).status).toBe(403)
  })

  it('sert au joueur ses erreurs contestables', async () => {
    const response = await disputable(apiRequest('http://test/disputable-errors', playerCookie))

    expect(response.status).toBe(200)
    const { errors } = await response.json()
    expect(errors).toMatchObject([{ questionId, submittedAnswer: 'Bordo' }])
  })

  it('ouvre une contestation, puis refuse la seconde', async () => {
    expect((await openOne()).status).toBe(200)

    expect((await openOne()).status).toBe(400)
    expect(await db.select().from(disputes)).toHaveLength(1)
  })

  it('montre la file à l admin, puis la vide en arbitrant', async () => {
    await openOne()

    const listed = await queue(apiRequest('http://test/disputes', adminCookie))
    const { disputes: pending } = await listed.json()
    expect(pending).toMatchObject([{ username: 'gandalf', submittedAnswer: 'Bordo' }])

    const settled = await settle(jsonRequest(
      `http://test/disputes/${pending[0].id}`,
      'PUT',
      { verdict: 'accepted' },
      adminCookie,
    ))

    expect(settled.status).toBe(200)
    expect((await (await queue(apiRequest('http://test/disputes', adminCookie))).json()).disputes)
      .toEqual([])
    expect((await loadPlayer(db, playerId)).lives).toBe(4)
  })

  it('refuse un verdict qui n en est pas un', async () => {
    await openOne()
    const [dispute] = await db.select().from(disputes)

    const response = await settle(jsonRequest(
      `http://test/disputes/${dispute.id}`,
      'PUT',
      { verdict: 'peut-être' },
      adminCookie,
    ))

    expect(response.status).toBe(400)
    expect(await db.select().from(disputes)).toMatchObject([{ status: 'pending' }])
  })

  it('répond 404 sur une contestation qui n existe pas', async () => {
    const response = await settle(jsonRequest(
      'http://test/disputes/404',
      'PUT',
      { verdict: 'rejected' },
      adminCookie,
    ))

    expect(response.status).toBe(404)
  })

  // Un identifiant qui ne peut désigner aucune contestation est une erreur du
  // client, pas une cible introuvable. Même lecture d'identifiant que les gestes
  // sur un joueur. Voir server/utils/routes.ts.
  it.each(['0', '-1', 'hier'])('refuse l identifiant %s en 400', async (id) => {
    const response = await settle(jsonRequest(
      `http://test/disputes/${id}`,
      'PUT',
      { verdict: 'rejected' },
      adminCookie,
    ))

    expect(response.status).toBe(400)
  })

  it('ne conteste pas pour un autre joueur', async () => {
    const other = await createPlayer(db, { discordId: '888', username: 'frodo' })
    await db.update(users).set({ lives: 3 }).where(eq(users.id, other))

    const response = await open(jsonRequest(
      'http://test/disputes',
      'POST',
      { questionId },
      await sessionCookieFor(other),
    ))

    expect(response.status).toBe(400)
    expect(await db.select().from(disputes)).toHaveLength(0)
  })
})
