import { beforeEach, describe, expect, it } from 'vitest'
import { setDatabase } from '../../server/db/client'
import { createPlayer, createTestDatabase } from '../helpers/db'
import { apiRequest, installNitroGlobals, mountHandler, sessionCookieFor } from '../helpers/nitro'
import type { Database } from '../../server/db/client'

installNitroGlobals()

const { default: logoutHandler } = await import('../../server/api/auth/logout.post')
const { default: meHandler } = await import('../../server/api/auth/me.get')

const logout = mountHandler('/logout', logoutHandler)
const me = mountHandler('/me', meHandler)

describe('déconnexion', () => {
  let db: Database

  beforeEach(async () => {
    db = await createTestDatabase()
    setDatabase(db)
  })

  it('vide la session : le cookie rendu ne désigne plus personne', async () => {
    const userId = await createPlayer(db)
    const cookie = await sessionCookieFor(userId)

    const response = await logout(new Request('http://test/logout', {
      method: 'POST',
      headers: { cookie },
    }))

    expect(response.status).toBe(200)
    const cleared = (response.headers.get('set-cookie') ?? '').split(';')[0]
    const after = await me(apiRequest('http://test/me', cleared))
    expect(await after.json()).toEqual({ user: null })
  })
})
