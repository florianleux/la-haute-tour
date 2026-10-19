import { beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { setDatabase } from '../../server/db/client'
import { items } from '../../server/db/schema'
import { createPlayer, createTestDatabase, loadPlayer } from '../helpers/db'
import { installNitroGlobals, jsonRequest, mountHandler, sessionCookieFor } from '../helpers/nitro'
import type { Database } from '../../server/db/client'

installNitroGlobals()

const { default: introHandler } = await import('../../server/api/profile/intro.post')

const finishIntro = mountHandler('/intro', introHandler)

async function itemsOf(db: Database, userId: number): Promise<string[]> {
  const rows = await db.select({ item: items.item }).from(items).where(eq(items.userId, userId))
  return rows.map(row => row.item)
}

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

  it('donne le Fromage au joueur qui la finit', async () => {
    await finishIntro(introRequest(await sessionCookieFor(playerId)))

    expect(await itemsOf(db, playerId)).toEqual(['CHEESE'])
  })

  // Le Fromage est écrit par un INSERT … SELECT, qui encode la date à la main :
  // elle doit se relire comme celle de la fin, posée par Drizzle.
  it('date le Fromage du moment où l introduction se finit', async () => {
    await finishIntro(introRequest(await sessionCookieFor(playerId)))

    const [cheese] = await db.select().from(items).where(eq(items.userId, playerId))
    expect(cheese.obtainedAt).toEqual((await loadPlayer(db, playerId)).introDoneAt)
  })

  it('ne donne le Fromage qu une fois, et ne réécrit pas la fin', async () => {
    const cookie = await sessionCookieFor(playerId)
    await finishIntro(introRequest(cookie))
    const doneAt = (await loadPlayer(db, playerId)).introDoneAt

    const response = await finishIntro(introRequest(cookie))

    expect(response.status).toBe(200)
    expect(await itemsOf(db, playerId)).toEqual(['CHEESE'])
    expect((await loadPlayer(db, playerId)).introDoneAt).toEqual(doneAt)
  })

  it('donne le Fromage au joueur test incarné, pas à l admin', async () => {
    const adminId = await createPlayer(db, { discordId: '999', username: 'saruman', isAdmin: true })
    const testerId = await createPlayer(db, { discordId: 'test-1', username: 'testeur', isTest: true })

    await finishIntro(introRequest(await sessionCookieFor(adminId, testerId)))

    expect(await itemsOf(db, testerId)).toEqual(['CHEESE'])
    expect(await itemsOf(db, adminId)).toEqual([])
  })
})
