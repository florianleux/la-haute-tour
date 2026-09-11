import { beforeEach, describe, expect, it } from 'vitest'
import { setDatabase } from '../../server/db/client'
import { achievements } from '../../server/db/schema'
import { createPlayer, createTestDatabase } from '../helpers/db'
import { apiRequest, installNitroGlobals, mountHandler, sessionCookieFor } from '../helpers/nitro'
import type { Database } from '../../server/db/client'

installNitroGlobals()

const { default: handler } = await import('../../server/api/profile/achievements.get')

const read = mountHandler('/achievements', handler)

const NOW = new Date('2026-09-04T12:00:00.000Z')

describe('les succès du profil', () => {
  let db: Database
  let playerId: number

  beforeEach(async () => {
    db = await createTestDatabase()
    setDatabase(db)
    playerId = await createPlayer(db)
  })

  it('reste fermé sans session', async () => {
    expect((await read(apiRequest('http://test/achievements'))).status).toBe(401)
  })

  it('rend ce qui est acquis, avec sa date', async () => {
    await db.insert(achievements).values({
      userId: playerId,
      achievement: 'FIRST_CORRECT',
      unlockedAt: NOW,
    })

    const response = await read(apiRequest('http://test/achievements', await sessionCookieFor(playerId)))

    expect(response.status).toBe(200)
    expect((await response.json()).unlocked).toEqual([
      { id: 'FIRST_CORRECT', unlockedAt: NOW.toISOString() },
    ])
  })

  it('rend une liste vide à qui n a rien débloqué', async () => {
    const response = await read(apiRequest('http://test/achievements', await sessionCookieFor(playerId)))

    expect((await response.json()).unlocked).toEqual([])
  })

  // Aucun palmarès ne se lit d ailleurs que du sien : la route ne porte pas
  // d identifiant, et ce que voit le joueur signé est le sien.
  it('ne montre pas le palmarès d un autre joueur', async () => {
    const other = await createPlayer(db, { discordId: 'other', username: 'frodo' })
    await db.insert(achievements).values({
      userId: other,
      achievement: 'GAME_COMPLETED',
      unlockedAt: NOW,
    })

    const response = await read(apiRequest('http://test/achievements', await sessionCookieFor(playerId)))

    expect((await response.json()).unlocked).toEqual([])
  })
})
