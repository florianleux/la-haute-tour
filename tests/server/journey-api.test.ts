import { beforeEach, describe, expect, it } from 'vitest'
import { setDatabase } from '../../server/db/client'
import { attempts } from '../../server/db/schema'
import { createPlayer, createQuestion, createTestDatabase, markSeen } from '../helpers/db'
import { apiRequest, installNitroGlobals, mountHandler, sessionCookieFor } from '../helpers/nitro'
import type { Database } from '../../server/db/client'

installNitroGlobals()

const { default: handler } = await import('../../server/api/profile/journey.get')

const journey = mountHandler('/journey', handler)

const NOW = new Date('2026-09-04T12:00:00.000Z')

describe('parcours du profil', () => {
  let db: Database
  let playerId: number

  beforeEach(async () => {
    db = await createTestDatabase()
    setDatabase(db)
    playerId = await createPlayer(db)
  })

  it('reste fermé sans session', async () => {
    expect((await journey(apiRequest('http://test/journey'))).status).toBe(401)
  })

  it('rend le parcours du joueur signé', async () => {
    const questionId = await createQuestion(db)
    await markSeen(db, playerId, questionId, { floor: 1, seenAt: NOW })
    await db.insert(attempts).values({
      userId: playerId,
      startedAt: NOW,
      endedAt: NOW,
      seen: 9,
      floor: 1,
    })

    const response = await journey(apiRequest('http://test/journey', await sessionCookieFor(playerId)))

    expect(response.status).toBe(200)
    expect((await response.json()).journey).toMatchObject({
      floor: 1,
      floorSeen: 1,
      floorTotal: 1,
      seen: 1,
      correct: 1,
      bestStreak: 1,
      attempts: 1,
      longestAttempt: 9,
      shortestAttempt: 9,
    })
  })

  it('ne rend que le sien : aucun identifiant ne se passe dans la route', async () => {
    const other = await createPlayer(db, { discordId: '999', username: 'saruman', currentFloor: 4 })
    const response = await journey(apiRequest('http://test/journey', await sessionCookieFor(other)))

    expect((await response.json()).journey.floor).toBe(4)
  })
})
