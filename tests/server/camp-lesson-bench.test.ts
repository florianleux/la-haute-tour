import { beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { setDatabase } from '../../server/db/client'
import { items, users } from '../../server/db/schema'
import { createPlayer, createTestDatabase, loadPlayer } from '../helpers/db'
import { installNitroGlobals, jsonRequest, mountHandler, sessionCookieFor } from '../helpers/nitro'
import type { Database } from '../../server/db/client'

installNitroGlobals()

const { default: benchHandler } = await import('../../server/api/admin/camp-lesson.post')

const replayCamp = mountHandler('/camp-lesson', benchHandler)

function benchRequest(cookie?: string): Request {
  return jsonRequest('http://test/camp-lesson', 'POST', { team: 'MIDI' }, cookie)
}

// Le banc de la leçon du camp (/test/camp) remet le joueur servi à la sortie
// de l'introduction : partie neuve, introduction finie, Fromage en poche.
describe('le banc de la leçon du camp', () => {
  let db: Database
  let adminId: number
  let testerId: number

  beforeEach(async () => {
    db = await createTestDatabase()
    setDatabase(db)
    adminId = await createPlayer(db, { discordId: '999', username: 'saruman', isAdmin: true })
    testerId = await createPlayer(db, { discordId: 'test-1', username: 'testeur', isTest: true, currentFloor: 3, campLessonAt: new Date(1_000) })
  })

  it('refuse un joueur qui n est pas admin', async () => {
    const playerId = await createPlayer(db, { discordId: 'joueur' })

    expect((await replayCamp(benchRequest(await sessionCookieFor(playerId)))).status).toBe(403)
  })

  it('remet le joueur test incarné à la sortie de l introduction', async () => {
    const response = await replayCamp(benchRequest(await sessionCookieFor(adminId, testerId)))

    expect(response.status).toBe(200)
    const tester = await loadPlayer(db, testerId)
    expect(tester).toMatchObject({ currentFloor: 1, campLessonAt: null })
    expect(tester.introDoneAt).toBeInstanceOf(Date)
    const bag = await db.select({ item: items.item }).from(items).where(eq(items.userId, testerId))
    expect(bag).toEqual([{ item: 'CHEESE' }])
  })

  it('donne au joueur la guilde demandée', async () => {
    await replayCamp(benchRequest(await sessionCookieFor(adminId, testerId)))

    expect((await loadPlayer(db, testerId)).team).toBe('MIDI')
  })

  // Hors développement, la partie d'un vrai compte ne se jette pas pour un banc.
  it('refuse de remettre à zéro le compte réel de l admin', async () => {
    await db.update(users).set({ currentFloor: 4 }).where(eq(users.id, adminId))

    const response = await replayCamp(benchRequest(await sessionCookieFor(adminId)))

    expect(response.status).toBe(403)
    expect((await loadPlayer(db, adminId)).currentFloor).toBe(4)
  })
})
