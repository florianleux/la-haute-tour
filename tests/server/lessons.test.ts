import { beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { setDatabase } from '../../server/db/client'
import { reservations, users } from '../../server/db/schema'
import { readGameState, serveNextQuestion } from '../../server/utils/game'
import { rulesForFloor } from '../../server/utils/rules'
import { createPlayer, createQuestion, createTestDatabase, loadPlayer, markSeen } from '../helpers/db'
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

  it('date la leçon du Grimoire', async () => {
    await markLesson(lessonRequest({ lesson: 'spellbook' }, await sessionCookieFor(playerId)))

    expect((await loadPlayer(db, playerId)).spellbookLessonAt).toBeInstanceOf(Date)
  })

  it('date la leçon de la Plume', async () => {
    await markLesson(lessonRequest({ lesson: 'quill' }, await sessionCookieFor(playerId)))

    expect((await loadPlayer(db, playerId)).quillLessonAt).toBeInstanceOf(Date)

    await markLesson(lessonRequest({ lesson: 'crystalBall' }, await sessionCookieFor(playerId)))

    expect((await loadPlayer(db, playerId)).crystalBallLessonAt).toBeInstanceOf(Date)

    await markLesson(lessonRequest({ lesson: 'leechNet' }, await sessionCookieFor(playerId)))

    expect((await loadPlayer(db, playerId)).leechNetLessonAt).toBeInstanceOf(Date)
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

// La leçon loot se joue sur la question, chrono retenu et énoncé pas servi.
// Voir specs/anti-triche.md#timer.
describe('la leçon de la question loot', () => {
  const rules = rulesForFloor(1)
  const SEEN_AT = new Date('2026-09-03T12:00:00.000Z')
  let db: Database
  let playerId: number

  beforeEach(async () => {
    db = await createTestDatabase()
    setDatabase(db)
    playerId = await createPlayer(db)
    const ids: string[] = []
    for (let i = 0; i < rules.questionsPerChest * 2; i++) {
      ids.push(await createQuestion(db, { statement: `Question ${i + 1} ?` }))
    }
    await markSeen(db, playerId, ids.slice(0, rules.questionsPerChest - 1), { floor: 1, seenAt: SEEN_AT, submittedAnswer: 'Bordeaux' })
  })

  async function reservedExpiry(): Promise<number | undefined> {
    const reservation = await db.select().from(reservations).where(eq(reservations.userId, playerId)).get()
    return reservation?.expiresAt.getTime()
  }

  it('retient le chrono et l énoncé tant qu elle n est pas vue', async () => {
    const now = new Date()
    const state = await serveNextQuestion(db, await loadPlayer(db, playerId), now)

    expect(state.question).toMatchObject({
      statement: '',
      lootQuestion: true,
      lootLesson: { timerMs: rules.ascentTimerMs, questionsPerChest: rules.questionsPerChest },
    })
    expect(await reservedExpiry()).toBeGreaterThan(now.getTime() + 24 * 60 * 60 * 1000)
  })

  it('tient la question le temps qu il faut : rien n expire pendant la leçon', async () => {
    const now = new Date()
    await serveNextQuestion(db, await loadPlayer(db, playerId), now)

    const later = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)
    const state = await readGameState(db, await loadPlayer(db, playerId), later)

    expect(state.lives).toBe((await loadPlayer(db, playerId)).lives)
    expect(state.verdict).toBeNull()
    expect(state.question?.lootLesson).not.toBeNull()
  })

  it('lance le chrono plein et sert l énoncé à sa fin', async () => {
    await serveNextQuestion(db, await loadPlayer(db, playerId), new Date())

    const before = Date.now()
    await markLesson(lessonRequest({ lesson: 'loot' }, await sessionCookieFor(playerId)))
    const player = await loadPlayer(db, playerId)
    const state = await readGameState(db, player, new Date())

    expect(player.lootLessonAt).not.toBeNull()
    expect(state.question?.statement).toMatch(/^Question/)
    expect(state.question?.lootLesson).toBeNull()
    expect(await reservedExpiry()).toBeLessThanOrEqual(Date.now() + rules.ascentTimerMs)
    // Les dates se stockent à la seconde.
    expect(await reservedExpiry()).toBeGreaterThanOrEqual(before + rules.ascentTimerMs - 1_000)
  })

  it('ne relance pas le chrono si la route est rappelée', async () => {
    await serveNextQuestion(db, await loadPlayer(db, playerId), new Date())
    const cookie = await sessionCookieFor(playerId)
    await markLesson(lessonRequest({ lesson: 'loot' }, cookie))
    await db.update(reservations).set({ expiresAt: new Date(5_000_000) }).where(eq(reservations.userId, playerId))

    await markLesson(lessonRequest({ lesson: 'loot' }, cookie))

    expect(await reservedExpiry()).toBe(5_000_000)
  })

  it('laisse tranquille la question loot d un joueur qui l a vue', async () => {
    await db.update(users).set({ lootLessonAt: new Date(1_000) }).where(eq(users.id, playerId))
    const now = new Date()
    const state = await serveNextQuestion(db, await loadPlayer(db, playerId), now)

    expect(state.question).toMatchObject({ statement: expect.stringMatching(/^Question/), lootQuestion: true, lootLesson: null })
    expect(await reservedExpiry()).toBeLessThanOrEqual(now.getTime() + rules.ascentTimerMs)
  })

  it('ne touche à aucune réservation quand la question n est pas loot', async () => {
    await db.update(users).set({ floorSeen: 0 }).where(eq(users.id, playerId))
    await serveNextQuestion(db, await loadPlayer(db, playerId), new Date())
    const served = await reservedExpiry()

    await markLesson(lessonRequest({ lesson: 'loot' }, await sessionCookieFor(playerId)))

    expect(await reservedExpiry()).toBe(served)
  })
})
