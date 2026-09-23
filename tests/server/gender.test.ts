import { beforeEach, describe, expect, it } from 'vitest'
import { setDatabase } from '../../server/db/client'
import { createPlayer, createTestDatabase, loadPlayer } from '../helpers/db'
import { installNitroGlobals, jsonRequest, mountHandler, sessionCookieFor } from '../helpers/nitro'
import type { Database } from '../../server/db/client'

installNitroGlobals()

const { default: genderHandler } = await import('../../server/api/profile/gender.put')

const setGender = mountHandler('/gender', genderHandler)

function genderRequest(body: unknown, cookie?: string): Request {
  return jsonRequest('http://test/gender', 'PUT', body, cookie)
}

describe('le genre donné à l introduction', () => {
  let db: Database
  let playerId: number
  let cookie: string

  beforeEach(async () => {
    db = await createTestDatabase()
    setDatabase(db)
    playerId = await createPlayer(db)
    cookie = await sessionCookieFor(playerId)
  })

  it('n en a aucun tant que le joueur n a pas répondu', async () => {
    expect((await loadPlayer(db, playerId)).gender).toBeNull()
  })

  it('refuse tout sans session', async () => {
    const response = await setGender(genderRequest({ gender: 'FEMALE' }))

    expect(response.status).toBe(401)
  })

  it('garde ce que le joueur a répondu', async () => {
    const response = await setGender(genderRequest({ gender: 'FEMALE' }, cookie))

    expect(response.status).toBe(200)
    expect((await loadPlayer(db, playerId)).gender).toBe('FEMALE')
  })

  it('garde aussi le refus de répondre', async () => {
    await setGender(genderRequest({ gender: 'UNDISCLOSED' }, cookie))

    expect((await loadPlayer(db, playerId)).gender).toBe('UNDISCLOSED')
  })

  it('réécrit la réponse quand l introduction se rejoue', async () => {
    await setGender(genderRequest({ gender: 'FEMALE' }, cookie))
    await setGender(genderRequest({ gender: 'MALE' }, cookie))

    expect((await loadPlayer(db, playerId)).gender).toBe('MALE')
  })

  it('rejette un genre qui n existe pas', async () => {
    const response = await setGender(genderRequest({ gender: 'ELF' }, cookie))

    expect(response.status).toBe(400)
    expect((await loadPlayer(db, playerId)).gender).toBeNull()
  })

  it('l écrit sur le joueur test que l admin incarne, pas sur l admin', async () => {
    const adminId = await createPlayer(db, { discordId: '999', username: 'saruman', isAdmin: true })
    const testerId = await createPlayer(db, { discordId: 'test-1', username: 'testeur', isTest: true })

    await setGender(genderRequest({ gender: 'FEMALE' }, await sessionCookieFor(adminId, testerId)))

    expect((await loadPlayer(db, testerId)).gender).toBe('FEMALE')
    expect((await loadPlayer(db, adminId)).gender).toBeNull()
  })
})
