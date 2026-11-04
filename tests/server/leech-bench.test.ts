import { desc, eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { setDatabase } from '../../server/db/client'
import { items, seenQuestions } from '../../server/db/schema'
import { openPlayerChest, readGameState } from '../../server/utils/game'
import { rulesForFloor } from '../../server/utils/rules'
import { createPlayer, createQuestion, createTestDatabase, loadPlayer } from '../helpers/db'
import { installNitroGlobals, jsonRequest, mountHandler, sessionCookieFor } from '../helpers/nitro'
import type { Database } from '../../server/db/client'

installNitroGlobals()

const { default: benchHandler } = await import('../../server/api/admin/leech-bench.post')

const prepareBench = mountHandler('/leech-bench', benchHandler)

// Le banc des Sangsues (/test/leeches) pose le joueur servi devant le coffre du Filet.
describe('le banc des Sangsues', () => {
  let db: Database
  let adminId: number
  let testerId: number

  beforeEach(async () => {
    db = await createTestDatabase()
    setDatabase(db)
    adminId = await createPlayer(db, { discordId: '999', username: 'saruman', isAdmin: true })
    testerId = await createPlayer(db, { discordId: 'test-1', username: 'testeur', isTest: true })

    // Plus de deux coffres d'étage : à mi-étage, le coffre donnerait la clé.
    for (let rank = 0; rank <= rulesForFloor(1).questionsPerChest * 3; rank++) {
      await createQuestion(db, { statement: `Question ${rank} ?`, accepted: ['Bordeaux'] })
    }
  })

  const request = async (playerId: number): Promise<Request> =>
    jsonRequest('http://test/leech-bench', 'POST', {}, await sessionCookieFor(adminId, playerId))

  it('refuse un joueur qui n est pas admin', async () => {
    const response = await prepareBench(jsonRequest('http://test/leech-bench', 'POST', {}, await sessionCookieFor(testerId)))

    expect(response.status).toBe(403)
  })

  it('pose le joueur devant un coffre fermé, à une vie, avec ses Sangsues', async () => {
    expect((await prepareBench(await request(testerId))).status).toBe(200)

    const player = await loadPlayer(db, testerId)
    expect(player).toMatchObject({ lives: 1, leechNetLessonAt: null })
    expect((await readGameState(db, player, new Date())).chest).toMatchObject({ opened: false })

    const failures = await db
      .select({ recoveryFailures: seenQuestions.recoveryFailures, correct: seenQuestions.correct })
      .from(seenQuestions)
      .where(eq(seenQuestions.userId, testerId))
      .orderBy(desc(seenQuestions.recoveryFailures))
      .limit(5)
    expect(failures.map(row => row.recoveryFailures)).toEqual([5, 4, 3, 3, 2])
    expect(failures.every(row => !row.correct)).toBe(true)
  })

  it('mène à un coffre qui donne le Filet', async () => {
    await prepareBench(await request(testerId))

    const state = await openPlayerChest(db, await loadPlayer(db, testerId), new Date())

    expect(state.chest).toMatchObject({ opened: true, item: 'LEECH_NET' })
    expect(await db.select({ item: items.item }).from(items).where(eq(items.userId, testerId))).toContainEqual({ item: 'LEECH_NET' })
  })
})
