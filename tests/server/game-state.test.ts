import { beforeEach, describe, expect, it } from 'vitest'
import { setDatabase } from '../../server/db/client'
import { users } from '../../server/db/schema'
import { createPlayer, createTestDatabase } from '../helpers/db'
import { apiRequest, installNitroGlobals, mountHandler, sessionCookieFor } from '../helpers/nitro'
import type { Database } from '../../server/db/client'

installNitroGlobals()

const { default: stateHandler } = await import('../../server/api/game/state.get')

const state = mountHandler('/state', stateHandler)

function stateRequest(cookie?: string): Request {
  return apiRequest('http://test/state', cookie)
}

describe('état de jeu', () => {
  let db: Database

  beforeEach(async () => {
    db = await createTestDatabase()
    setDatabase(db)
  })

  it('refuse la lecture sans session', async () => {
    const response = await state(stateRequest())

    expect(response.status).toBe(401)
  })

  it('renvoie l étage et les vies du joueur connecté', async () => {
    const userId = await createPlayer(db, { currentFloor: 3, lives: 2 })

    const response = await state(stateRequest(await sessionCookieFor(userId)))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ floor: 3, lives: 2 })
  })

  it('ne modifie rien : la lecture est sans effet', async () => {
    const userId = await createPlayer(db, { currentFloor: 3, lives: 2 })
    const cookie = await sessionCookieFor(userId)
    const before = await db.select().from(users)

    await state(stateRequest(cookie))
    await state(stateRequest(cookie))

    expect(await db.select().from(users)).toEqual(before)
  })
})
