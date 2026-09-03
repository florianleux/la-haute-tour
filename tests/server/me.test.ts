import { beforeEach, describe, expect, it } from 'vitest'
import { setDatabase } from '../../server/db/client'
import { createPlayer, createTestDatabase } from '../helpers/db'
import { apiRequest, installNitroGlobals, mountHandler, sessionCookieFor } from '../helpers/nitro'
import type { Database } from '../../server/db/client'

installNitroGlobals()

const { default: meHandler } = await import('../../server/api/auth/me.get')

const me = mountHandler('/me', meHandler)

const SIGNED_UP_AT = new Date('2026-09-01T10:00:00.000Z')

function meRequest(cookie?: string): Request {
  return apiRequest('http://test/me', cookie)
}

describe('identité du joueur', () => {
  let db: Database

  beforeEach(async () => {
    db = await createTestDatabase()
    setDatabase(db)
  })

  it('ne renvoie personne sans session', async () => {
    const response = await me(meRequest())

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ user: null })
  })

  it('renvoie le pseudo et la date d inscription du joueur connecté', async () => {
    const userId = await createPlayer(db, { createdAt: SIGNED_UP_AT })

    const response = await me(meRequest(await sessionCookieFor(userId)))

    expect(await response.json()).toEqual({
      user: {
        id: userId,
        username: 'gandalf',
        isAdmin: false,
        createdAt: '2026-09-01T10:00:00.000Z',
      },
    })
  })

  it('ne porte aucun état de jeu : il vient de l endpoint d état de jeu', async () => {
    const userId = await createPlayer(db, { currentFloor: 3, lives: 2 })

    const response = await me(meRequest(await sessionCookieFor(userId)))

    const { user } = await response.json()
    expect(user).not.toHaveProperty('currentFloor')
    expect(user).not.toHaveProperty('lives')
  })
})
