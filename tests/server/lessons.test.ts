import { beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { setDatabase } from '../../server/db/client'
import { users } from '../../server/db/schema'
import { createPlayer, createTestDatabase, loadPlayer } from '../helpers/db'
import { installNitroGlobals, jsonRequest, mountHandler, sessionCookieFor } from '../helpers/nitro'
import type { Database } from '../../server/db/client'

installNitroGlobals()

const { default: lessonsHandler } = await import('../../server/api/profile/lessons.post')

const markLesson = mountHandler('/lessons', lessonsHandler)

function lessonRequest(body: unknown, cookie?: string): Request {
  return jsonRequest('http://test/lessons', 'POST', body, cookie)
}

// Chaque leçon vue est datée sur le compte du joueur, une fois.
// Voir specs/spec.md (glossaire, « Leçon »).
describe('une leçon de Michel vue', () => {
  let db: Database
  let playerId: number

  beforeEach(async () => {
    db = await createTestDatabase()
    setDatabase(db)
    playerId = await createPlayer(db)
  })

  it('refuse tout sans session', async () => {
    expect((await markLesson(lessonRequest({ lesson: 'camp' }))).status).toBe(401)
  })

  it('refuse une leçon qui n existe pas', async () => {
    const response = await markLesson(lessonRequest({ lesson: 'cuisine' }, await sessionCookieFor(playerId)))

    expect(response.status).toBe(400)
  })

  it('date la leçon du camp', async () => {
    const response = await markLesson(lessonRequest({ lesson: 'camp' }, await sessionCookieFor(playerId)))

    expect(response.status).toBe(200)
    expect((await loadPlayer(db, playerId)).campLessonAt).toBeInstanceOf(Date)
  })

  it('date la leçon de la chute, sans toucher à celle du camp', async () => {
    const response = await markLesson(lessonRequest({ lesson: 'fall' }, await sessionCookieFor(playerId)))

    expect(response.status).toBe(200)
    expect(await loadPlayer(db, playerId)).toMatchObject({ fallLessonAt: expect.any(Date), campLessonAt: null })
  })

  it('date la leçon du rattrapage', async () => {
    await markLesson(lessonRequest({ lesson: 'recovery' }, await sessionCookieFor(playerId)))

    expect((await loadPlayer(db, playerId)).recoveryLessonAt).toBeInstanceOf(Date)
  })

  it('ne réécrit pas une date déjà posée', async () => {
    const seenAt = new Date(1_000)
    await db.update(users).set({ campLessonAt: seenAt }).where(eq(users.id, playerId))

    const response = await markLesson(lessonRequest({ lesson: 'camp' }, await sessionCookieFor(playerId)))

    expect(response.status).toBe(200)
    expect((await loadPlayer(db, playerId)).campLessonAt).toEqual(seenAt)
  })

  it('l écrit sur le joueur test que l admin incarne, pas sur l admin', async () => {
    const adminId = await createPlayer(db, { discordId: '999', username: 'saruman', isAdmin: true })
    const testerId = await createPlayer(db, { discordId: 'test-1', username: 'testeur', isTest: true })

    await markLesson(lessonRequest({ lesson: 'camp' }, await sessionCookieFor(adminId, testerId)))

    expect((await loadPlayer(db, testerId)).campLessonAt).toBeInstanceOf(Date)
    expect((await loadPlayer(db, adminId)).campLessonAt).toBeNull()
  })
})
