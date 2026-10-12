import { beforeEach, describe, expect, it } from 'vitest'
import { setDatabase } from '../../server/db/client'
import { createPlayer, createTestDatabase } from '../helpers/db'
import { installNitroGlobals, jsonRequest, mountHandler, sessionCookieFor } from '../helpers/nitro'

installNitroGlobals()

const { default: maintenanceHandler } = await import('../../server/api/admin/maintenance.post')

const maintenance = mountHandler('/maintenance', maintenanceHandler)

describe('interrupteur de maintenance', () => {
  let adminCookie: string

  beforeEach(async () => {
    const db = await createTestDatabase()
    setDatabase(db)
    adminCookie = await sessionCookieFor(await createPlayer(db, { isAdmin: true }))
  })

  it('ferme le jeu et dit depuis quand', async () => {
    const response = await maintenance(jsonRequest('http://test/maintenance', 'POST', { closed: true }, adminCookie))

    expect(response.status).toBe(200)
    expect((await response.json()).since).toEqual(expect.any(String))
  })

  it('rejette un corps invalide en 400, pas en erreur serveur', async () => {
    const response = await maintenance(jsonRequest('http://test/maintenance', 'POST', { closed: 'oui' }, adminCookie))

    expect(response.status).toBe(400)
  })
})
