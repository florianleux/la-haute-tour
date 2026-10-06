import { beforeEach, describe, expect, it } from 'vitest'
import { setDatabase } from '../../server/db/client'
import { createPlayer, createTestDatabase, loadPlayer } from '../helpers/db'
import { installNitroGlobals, jsonRequest, mountHandler, sessionCookieFor } from '../helpers/nitro'
import type { Database } from '../../server/db/client'

installNitroGlobals()

const { default: introHandler } = await import('../../server/api/profile/intro.post')

const finishIntro = mountHandler('/intro', introHandler)

function introRequest(cookie?: string): Request {
  return jsonRequest('http://test/intro', 'POST', {}, cookie)
}

describe('la fin de l introduction', () => {
  let db: Database
  let playerId: number

  beforeEach(async () => {
    db = await createTestDatabase()
    setDatabase(db)
    playerId = await createPlayer(db)
  })

  it('n est pas finie pour un joueur neuf', async () => {
    expect((await loadPlayer(db, playerId)).introDoneAt).toBeNull()
  })

  it('refuse tout sans session', async () => {
    const response = await finishIntro(introRequest())

    expect(response.status).toBe(401)
  })

  it('est gardée sur le joueur qui la finit', async () => {
    const response = await finishIntro(introRequest(await sessionCookieFor(playerId)))

    expect(response.status).toBe(200)
    expect((await loadPlayer(db, playerId)).introDoneAt).toBeInstanceOf(Date)
  })

  it('l écrit sur le joueur test que l admin incarne, pas sur l admin', async () => {
    const adminId = await createPlayer(db, { discordId: '999', username: 'saruman', isAdmin: true })
    const testerId = await createPlayer(db, { discordId: 'test-1', username: 'testeur', isTest: true })

    await finishIntro(introRequest(await sessionCookieFor(adminId, testerId)))

    expect((await loadPlayer(db, testerId)).introDoneAt).toBeInstanceOf(Date)
    expect((await loadPlayer(db, adminId)).introDoneAt).toBeNull()
  })
})
