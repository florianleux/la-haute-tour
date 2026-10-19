import { readFileSync } from 'node:fs'
import { eq, sql } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  achievements,
  activeEffects,
  attempts,
  disputes,
  items,
  missedPool,
  pocketSpells,
  seenQuestions,
  users,
} from '../../server/db/schema'
import { resetPlayer } from '../../server/utils/players'
import { createPlayer, createQuestion, createTestDatabase, loadPlayer, markSeen } from '../helpers/db'
import { installNitroGlobals } from '../helpers/nitro'
import type { Database } from '../../server/db/client'
import type { User } from '../../server/db/schema'

installNitroGlobals()

const NOW = new Date('2026-10-19T12:00:00.000Z')

/** La migration de rattrapage, rejouée sur une base déjà migrée. */
async function runMigration(db: Database): Promise<void> {
  const file = readFileSync('./drizzle/0030_reset_finished_intros.sql', 'utf8')
  for (const statement of file.split('--> statement-breakpoint')) {
    if (statement.trim()) {
      await db.run(sql.raw(statement))
    }
  }
}

/** Ce que la partie d'un joueur laisse derrière elle, table par table. */
async function leftovers(db: Database, userId: number): Promise<Record<string, number>> {
  const counts: Record<string, number> = {}
  for (const [name, table] of Object.entries({ seenQuestions, missedPool, pocketSpells, items, attempts, disputes, achievements })) {
    counts[name] = (await db.select().from(table).where(eq(table.userId, userId))).length
  }
  counts.activeEffects = (await db.select().from(activeEffects).where(eq(activeEffects.userId, userId))).length
  counts.castEffects = (await db.select().from(activeEffects).where(eq(activeEffects.casterId, userId))).length
  return counts
}

/** Le joueur sans ce qui le distingue d'un autre, ni l'heure de sa remise à zéro. */
function gameOf(player: User): Partial<User> {
  const { id: _id, discordId: _discordId, username: _username, attemptStartedAt: _startedAt, ...game } = player
  return game
}

// Les joueurs qui ont fini l'introduction avant le Fromage n'en ont pas : la
// migration les remet à zéro, comme le geste de l'admin, pour qu'ils la
// rejouent et le reçoivent. Voir specs/admin.md#gestion-des-joueurs.
describe('la remise à zéro des introductions finies sans Fromage', () => {
  let db: Database
  let questionId: string

  beforeEach(async () => {
    db = await createTestDatabase()
    questionId = await createQuestion(db)
  })

  /** Un joueur en pleine partie, l'introduction finie. */
  async function playing(discordId: string, isTest = false): Promise<number> {
    const userId = await createPlayer(db, {
      discordId,
      isTest,
      introDoneAt: NOW,
      gender: 'FEMALE',
      currentFloor: 3,
      lives: 1,
      floorSeen: 4,
      seenTotal: 12,
      streak: 2,
      lastChest: 'spell',
      achievementsHeld: ['FIRST_CORRECT'],
    })
    await markSeen(db, userId, questionId, { floor: 1, correct: false, submittedAnswer: 'nawak' })
    await db.insert(missedPool).values({ userId, questionId, floor: 1, lastFailedAt: NOW })
    await db.insert(pocketSpells).values({ userId, spell: 'VITALITY', obtainedAt: NOW })
    await db.insert(disputes).values({ userId, questionId, status: 'pending', createdAt: NOW })
    await db.insert(activeEffects).values({ userId, casterId: userId, spell: 'VITALITY', face: 'boon', castAt: NOW })
    await db.insert(achievements).values({ userId, achievement: 'FIRST_CORRECT', unlockedAt: NOW })
    return userId
  }

  // Un joueur test perd aussi son palmarès, comme sous le geste de l'admin.
  it.each([false, true])('remet le joueur comme le ferait l admin (joueur test : %s)', async (isTest) => {
    const byAdmin = await playing(`admin-reset-${isTest}`, isTest)
    const byMigration = await playing(`migration-reset-${isTest}`, isTest)

    await resetPlayer(db, await loadPlayer(db, byAdmin), NOW)
    await runMigration(db)

    expect(gameOf(await loadPlayer(db, byMigration))).toEqual(gameOf(await loadPlayer(db, byAdmin)))
    expect(await leftovers(db, byMigration)).toEqual(await leftovers(db, byAdmin))
  })

  it('ne touche pas le joueur qui n a pas fini l introduction', async () => {
    const userId = await createPlayer(db, { discordId: 'newcomer', gender: 'MALE' })
    const before = await loadPlayer(db, userId)

    await runMigration(db)

    expect(await loadPlayer(db, userId)).toEqual(before)
  })

  it('le renvoie à l introduction, qui lui donnera le Fromage', async () => {
    const userId = await playing('finished')

    await runMigration(db)

    expect(await loadPlayer(db, userId)).toMatchObject({ introDoneAt: null, gender: null })
    expect((await db.select().from(users).where(eq(users.id, userId)))[0].attemptStartedAt).toBeInstanceOf(Date)
  })
})
