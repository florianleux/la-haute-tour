import { beforeEach, describe, expect, it } from 'vitest'
import { setDatabase } from '../../server/db/client'
import { focusLosses } from '../../server/db/schema'
import { createPlayer, createQuestion, createTestDatabase } from '../helpers/db'
import { apiRequest, installNitroGlobals, mountHandler, sessionCookieFor } from '../helpers/nitro'
import type { Database } from '../../server/db/client'

installNitroGlobals()

const { default: handler } = await import('../../server/api/admin/focus-losses.get')

const tally = mountHandler('/focus-losses', handler)

const NOW = new Date('2026-09-03T12:00:00.000Z')

describe('flags de perte de focus', () => {
  let db: Database
  let adminCookie: string
  let playerId: number

  beforeEach(async () => {
    db = await createTestDatabase()
    setDatabase(db)
    playerId = await createPlayer(db)
    adminCookie = await sessionCookieFor(
      await createPlayer(db, { discordId: '999', username: 'saruman', isAdmin: true }),
    )
  })

  it('reste invisible sans session, et pour un joueur ordinaire', async () => {
    expect((await tally(apiRequest('http://test/focus-losses'))).status).toBe(401)

    const cookie = await sessionCookieFor(playerId)
    expect((await tally(apiRequest('http://test/focus-losses', cookie))).status).toBe(403)
  })

  it('compte les pertes par joueur, la plus fournie en tête', async () => {
    const first = await createQuestion(db)
    const second = await createQuestion(db, { statement: 'Autre ?' })
    await db.insert(focusLosses).values([
      { userId: playerId, questionId: first, mode: 'ascent', lostAt: NOW },
      { userId: playerId, questionId: second, mode: 'recovery', lostAt: new Date(NOW.getTime() + 60_000) },
    ])

    const response = await tally(apiRequest('http://test/focus-losses', adminCookie))

    expect(response.status).toBe(200)
    const { players } = await response.json()
    expect(players).toEqual([{
      userId: playerId,
      username: 'gandalf',
      losses: 2,
      lastAt: new Date(NOW.getTime() + 60_000).toISOString(),
    }])
  })

  it('ne montre personne quand personne n a quitté la page', async () => {
    const response = await tally(apiRequest('http://test/focus-losses', adminCookie))

    expect((await response.json()).players).toEqual([])
  })
})
