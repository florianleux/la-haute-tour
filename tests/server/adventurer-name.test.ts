import { beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { setDatabase } from '../../server/db/client'
import { users } from '../../server/db/schema'
import { createPlayer, createTestDatabase, loadPlayer } from '../helpers/db'
import { installNitroGlobals, jsonRequest, mountHandler, sessionCookieFor } from '../helpers/nitro'
import type { Database } from '../../server/db/client'

installNitroGlobals()

const { default: nameHandler } = await import('../../server/api/profile/name.put')

const setName = mountHandler('/name', nameHandler)

function nameRequest(body: unknown, cookie?: string): Request {
  return jsonRequest('http://test/name', 'PUT', body, cookie)
}

describe('le nom d aventurier donné à l introduction', () => {
  let db: Database
  let playerId: number
  let cookie: string

  beforeEach(async () => {
    db = await createTestDatabase()
    setDatabase(db)
    playerId = await createPlayer(db)
    cookie = await sessionCookieFor(playerId)
  })

  it('n en a aucun tant que le joueur ne s est pas nommé', async () => {
    expect((await loadPlayer(db, playerId)).adventurerName).toBeNull()
  })

  it('refuse tout sans session', async () => {
    const response = await setName(nameRequest({ name: 'Bilbon' }))

    expect(response.status).toBe(401)
  })

  it('garde le nom, espaces de bout coupés', async () => {
    const response = await setName(nameRequest({ name: '  Bilbon  ' }, cookie))

    expect(response.status).toBe(200)
    expect((await loadPlayer(db, playerId)).adventurerName).toBe('Bilbon')
  })

  it.each([
    ['vide', ''],
    ['fait d espaces', '   '],
    ['de plus de 15 caractères', 'Bilbon Sacquet de Cul-de-Sac'],
  ])('rejette un nom %s', async (_, name) => {
    const response = await setName(nameRequest({ name }, cookie))

    expect(response.status).toBe(400)
    expect((await loadPlayer(db, playerId)).adventurerName).toBeNull()
  })

  it('accepte 15 caractères tout juste', async () => {
    await setName(nameRequest({ name: 'Bilbon Sacquet!' }, cookie))

    expect((await loadPlayer(db, playerId)).adventurerName).toBe('Bilbon Sacquet!')
  })

  // Quitter l'introduction avant la fin la fait reprendre du début.
  it('réécrit le nom tant que l introduction n est pas finie', async () => {
    await setName(nameRequest({ name: 'Bilbon' }, cookie))
    await setName(nameRequest({ name: 'Frodon' }, cookie))

    expect((await loadPlayer(db, playerId)).adventurerName).toBe('Frodon')
  })

  // Le nom se donne une fois, à l'introduction. Voir specs/spec.md (glossaire,
  // « Nom d'aventurier »).
  it('ne change plus une fois l introduction finie', async () => {
    await setName(nameRequest({ name: 'Bilbon' }, cookie))
    await db.update(users).set({ introDoneAt: new Date() }).where(eq(users.id, playerId))

    const response = await setName(nameRequest({ name: 'Frodon' }, cookie))

    expect(response.status).toBe(200)
    expect((await loadPlayer(db, playerId)).adventurerName).toBe('Bilbon')
  })

  it('ne touche jamais au pseudo Discord', async () => {
    await setName(nameRequest({ name: 'Bilbon' }, cookie))

    expect((await loadPlayer(db, playerId)).username).toBe('gandalf')
  })

  it('l écrit sur le joueur test que l admin incarne, pas sur l admin', async () => {
    const adminId = await createPlayer(db, { discordId: '999', username: 'saruman', isAdmin: true })
    const testerId = await createPlayer(db, { discordId: 'test-1', username: 'testeur', isTest: true })

    await setName(nameRequest({ name: 'Bilbon' }, await sessionCookieFor(adminId, testerId)))

    expect((await loadPlayer(db, testerId)).adventurerName).toBe('Bilbon')
    expect((await loadPlayer(db, adminId)).adventurerName).toBeNull()
  })
})
