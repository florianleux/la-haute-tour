import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setDatabase } from '../../server/db/client'
import { achievements } from '../../server/db/schema'
import { createPlayer, createTestDatabase } from '../helpers/db'
import { installNitroGlobals, jsonRequest, mountHandler, sessionCookieFor } from '../helpers/nitro'
import type { Database } from '../../server/db/client'

installNitroGlobals()

const { default: handler } = await import('../../server/api/profile/night-camp.post')

const claim = mountHandler('/night-camp', handler)

describe('Oiseau de nuit', () => {
  let db: Database
  let playerId: number

  beforeEach(async () => {
    db = await createTestDatabase()
    setDatabase(db)
    playerId = await createPlayer(db)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  async function post(): Promise<Response> {
    return claim(jsonRequest('http://test/night-camp', 'POST', undefined, await sessionCookieFor(playerId)))
  }

  it('reste fermé sans session', async () => {
    expect((await claim(jsonRequest('http://test/night-camp', 'POST'))).status).toBe(401)
  })

  it('se grave une seule fois, la nuit', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-04T21:00:00.000Z'))

    expect((await (await post()).json()).unlocked).toEqual(['CAMP_AT_NIGHT'])
    expect((await (await post()).json()).unlocked).toEqual([])
    expect(await db.select().from(achievements)).toHaveLength(1)
  })

  it('ne donne rien le jour, quoi que dise l écran', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-04T12:00:00.000Z'))

    expect((await (await post()).json()).unlocked).toEqual([])
    expect(await db.select().from(achievements)).toHaveLength(0)
  })
})
