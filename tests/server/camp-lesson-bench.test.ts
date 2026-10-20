import { beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { setDatabase } from '../../server/db/client'
import { items, missedPool, pocketSpells, users } from '../../server/db/schema'
import { createPlayer, createQuestion, createTestDatabase, loadPlayer } from '../helpers/db'
import { installNitroGlobals, jsonRequest, mountHandler, sessionCookieFor } from '../helpers/nitro'
import type { Database } from '../../server/db/client'
import type { LessonId } from '../../shared/utils/lessons'

installNitroGlobals()

const { default: benchHandler } = await import('../../server/api/admin/camp-lesson.post')

const replayCamp = mountHandler('/camp-lesson', benchHandler)

function benchRequest(cookie?: string, lesson?: LessonId, team: string | null = 'MIDI'): Request {
  return jsonRequest('http://test/camp-lesson', 'POST', { team, lesson }, cookie)
}

let db: Database
let adminId: number
let testerId: number

beforeEach(async () => {
  db = await createTestDatabase()
  setDatabase(db)
  adminId = await createPlayer(db, { discordId: '999', username: 'saruman', isAdmin: true })
  testerId = await createPlayer(db, {
    discordId: 'test-1',
    username: 'testeur',
    isTest: true,
    currentFloor: 3,
    campLessonAt: new Date(1_000),
    fallLessonAt: new Date(1_000),
  })
})

// Le banc de la leçon du camp (/test/camp) remet le joueur servi à la sortie
// de l'introduction : partie neuve, introduction finie, Fromage en poche.
describe('le banc de la leçon du camp', () => {
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

// Le même banc, pour la leçon de la chute (/test/camp?lesson=fall) : le joueur
// servi joue une vraie partie jusqu'à perdre sa dernière vie.
describe('le banc de la leçon de la chute', () => {
  beforeEach(async () => {
    for (let i = 0; i < 5; i++) {
      await createQuestion(db, { statement: `Question ${i} ?`, accepted: [`r${i}`] })
    }
  })

  it('remet le joueur test juste après sa première chute, leçon de la chute à voir', async () => {
    const response = await replayCamp(benchRequest(await sessionCookieFor(adminId, testerId), 'fall'))

    expect(response.status).toBe(200)
    const tester = await loadPlayer(db, testerId)
    expect(tester).toMatchObject({ lives: 0, fallLessonAt: null, team: 'MIDI' })
    expect(tester.cooldownUntil).toBeInstanceOf(Date)
    expect(tester.introDoneAt).toBeInstanceOf(Date)
    expect(tester.campLessonAt).toBeInstanceOf(Date)
    expect(await db.select().from(missedPool).where(eq(missedPool.userId, testerId))).toHaveLength(3)
    expect(await db.select().from(items).where(eq(items.userId, testerId))).toEqual([])
  })

  it('remet le joueur à l échéance de sa première attente, leçon du rattrapage à voir', async () => {
    await replayCamp(benchRequest(await sessionCookieFor(adminId, testerId), 'recovery'))

    const tester = await loadPlayer(db, testerId)
    expect(tester).toMatchObject({ lives: 0, recoveryLessonAt: null })
    expect(tester.cooldownUntil?.getTime()).toBeLessThanOrEqual(Date.now())
    expect(tester.fallLessonAt).toBeInstanceOf(Date)
    expect(await db.select().from(missedPool).where(eq(missedPool.userId, testerId))).toHaveLength(3)
  })

  // La leçon sans équipe ne parle que du lancer sur soi : elle doit se voir.
  it('peut remettre le joueur sans équipe', async () => {
    const response = await replayCamp(benchRequest(await sessionCookieFor(adminId, testerId), 'spellbook', null))

    expect(response.status).toBe(200)
    expect((await loadPlayer(db, testerId)).team).toBeNull()
  })

  it('remet le joueur au camp au repos, Vitalité en poche, leçon du Grimoire à voir', async () => {
    await replayCamp(benchRequest(await sessionCookieFor(adminId, testerId), 'spellbook'))

    const tester = await loadPlayer(db, testerId)
    expect(tester).toMatchObject({ spellbookLessonAt: null, cooldownUntil: null })
    expect(tester.campLessonAt).toBeInstanceOf(Date)
    expect(tester.lives).toBeGreaterThan(0)
    expect(await db.select({ spell: pocketSpells.spell }).from(pocketSpells).where(eq(pocketSpells.userId, testerId)))
      .toEqual([{ spell: 'VITALITY' }])
  })
})
