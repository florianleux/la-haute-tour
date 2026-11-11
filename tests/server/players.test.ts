import { beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { achievements, bossKeys, disputes, items, missedPool, pocketSpells, users } from '../../server/db/schema'
import { disputableErrors } from '../../server/utils/disputes'
import { playerRoster, resetPlayer } from '../../server/utils/players'
import { createPlayer, createQuestion, createTestDatabase, loadPlayer, markSeen } from '../helpers/db'
import { installNitroGlobals } from '../helpers/nitro'
import type { Database } from '../../server/db/client'

installNitroGlobals()

const NOW = new Date('2026-09-04T12:00:00.000Z')
const HOUR_MS = 60 * 60 * 1000

/** Les questions de l'étage, pour que la progression ait un dénominateur. */
async function seedFloor(db: Database, floor: number, howMany: number): Promise<string[]> {
  const ids: string[] = []
  for (let index = 0; index < howMany; index += 1) {
    ids.push(await createQuestion(db, { floor, statement: `Question ${floor}.${index} ?` }))
  }
  return ids
}

describe('fiches joueurs', () => {
  let db: Database

  beforeEach(async () => {
    db = await createTestDatabase()
  })

  it('rend la progression dans l étage et la phase d ascension', async () => {
    const questionIds = await seedFloor(db, 1, 4)
    const userId = await createPlayer(db, { currentFloor: 1, lives: 3 })
    await markSeen(db, userId, questionIds[0], { floor: 1, seenAt: NOW })
    await markSeen(db, userId, questionIds[1], { floor: 1, correct: false, seenAt: NOW })

    expect(await playerRoster(db, NOW)).toEqual([{
      userId,
      username: 'gandalf',
      adventurerName: null,
      discordId: '123456789',
      avatar: null,
      floor: 1,
      lives: 3,
      phase: 'ascent',
      floorSeen: 2,
      floorTotal: 4,
      cooldownUntil: null,
      // Personne n\'est placé tant que l\'admin ne le fait pas.
      team: null,
      ownsKey: false,
      lastPlayedDay: null,
      items: [],
      spells: [],
      chestsOffered: 0,
      chestsOpened: 0,
    }])
  })

  it('rend le sac dans l ordre reçu et les sorts comptés par exemplaire', async () => {
    const userId = await createPlayer(db)
    await db.insert(items).values([
      { userId, item: 'MUSHROOM', obtainedAt: new Date(NOW.getTime() + 1000) },
      { userId, item: 'CHEESE', obtainedAt: NOW },
    ])
    await db.insert(pocketSpells).values([
      { userId, spell: 'PURGE', obtainedAt: NOW },
      { userId, spell: 'VITALITY', obtainedAt: NOW },
      { userId, spell: 'VITALITY', obtainedAt: NOW },
    ])

    expect((await playerRoster(db, NOW))[0]).toMatchObject({
      items: ['CHEESE', 'MUSHROOM'],
      spells: [{ spell: 'PURGE', count: 1 }, { spell: 'VITALITY', count: 2 }],
    })
  })

  it('rend l attente en cours et son échéance', async () => {
    await seedFloor(db, 1, 4)
    const cooldownUntil = new Date(NOW.getTime() + 3 * HOUR_MS)
    const userId = await createPlayer(db, { lives: 0, cooldownUntil })

    const [card] = await playerRoster(db, NOW)

    expect(card).toMatchObject({
      userId,
      phase: 'cooldown',
      lives: 0,
      cooldownUntil: cooldownUntil.toISOString(),
    })
  })

  it('passe en rattrapage dès que l échéance est derrière', async () => {
    await seedFloor(db, 1, 4)
    await createPlayer(db, { lives: 0, cooldownUntil: new Date(NOW.getTime() - 1) })

    expect((await playerRoster(db, NOW))[0].phase).toBe('recovery')
  })

  it('annonce le palier quand l étage est épuisé', async () => {
    const questionIds = await seedFloor(db, 1, 2)
    // Le palier mène quelque part : sans question au-dessus, c'est la fin du deck.
    await seedFloor(db, 2, 1)
    const userId = await createPlayer(db, { currentFloor: 1 })
    await markSeen(db, userId, questionIds, { floor: 1, seenAt: NOW })

    expect((await playerRoster(db, NOW))[0]).toMatchObject({ phase: 'bossDoor', floorSeen: 2 })
  })

  it('range les joueurs par pseudo', async () => {
    await createPlayer(db, { discordId: '1', username: 'saruman' })
    await createPlayer(db, { discordId: '2', username: 'aragorn' })

    expect((await playerRoster(db, NOW)).map(card => card.username))
      .toEqual(['aragorn', 'saruman'])
  })
})

// Voir specs/admin.md#gestion-des-joueurs : la partie effacée emporte ses
// contestations, en cours comme tranchées.
describe('repartir de zéro', () => {
  let db: Database
  let userId: number
  let questionId: string

  beforeEach(async () => {
    db = await createTestDatabase()
    ;[questionId] = await seedFloor(db, 1, 1)
    userId = await createPlayer(db)
  })

  /** La question ratée sur une vraie réponse, donc contestable. */
  async function miss(): Promise<void> {
    await markSeen(db, userId, questionId, { floor: 1, correct: false, submittedAnswer: 'nawak' })
    await db.insert(missedPool).values({ userId, questionId, floor: 1, lastFailedAt: NOW })
  }

  it('ne laisse aucune contestation à arbitrer sur la fiche', async () => {
    await db.insert(disputes).values({ userId, questionId, status: 'pending', createdAt: NOW })

    await resetPlayer(db, await loadPlayer(db, userId), NOW)

    expect(await db.select().from(disputes).where(eq(disputes.userId, userId))).toEqual([])
  })

  it('remet les compteurs des succès et des coffres à zéro, même chez un vrai joueur', async () => {
    await db
      .update(users)
      .set({ seenTotal: 42, lastPlayedDay: '2026-09-03', daysPlayed: 5, playStreak: 2, chestsOffered: 4, chestsOpened: 3 })
      .where(eq(users.id, userId))

    await resetPlayer(db, await loadPlayer(db, userId), NOW)

    expect(await loadPlayer(db, userId)).toMatchObject({
      seenTotal: 0,
      lastPlayedDay: null,
      daysPlayed: 0,
      playStreak: 0,
      chestsOffered: 0,
      chestsOpened: 0,
    })
  })

  it('efface le palmarès, même chez un vrai joueur', async () => {
    await db.update(users).set({ achievementsHeld: ['FIRST_CORRECT'] }).where(eq(users.id, userId))
    await db.insert(achievements).values({ userId, achievement: 'FIRST_CORRECT', unlockedAt: NOW })

    await resetPlayer(db, await loadPlayer(db, userId), NOW)

    expect(await db.select().from(achievements).where(eq(achievements.userId, userId))).toEqual([])
    expect((await loadPlayer(db, userId)).achievementsHeld).toEqual([])
  })

  it('efface ses clés du boss', async () => {
    await db.insert(bossKeys).values({ userId, floor: 1, obtainedAt: NOW })

    await resetPlayer(db, await loadPlayer(db, userId), NOW)

    expect(await db.select().from(bossKeys)).toHaveLength(0)
  })

  // L'introduction rejouée redonne le Fromage, redemande le nom et le genre.
  // Voir specs/admin.md#gestion-des-joueurs.
  it('efface les Objets, le nom et le genre, et renvoie à l introduction', async () => {
    await db.update(users).set({ introDoneAt: NOW, adventurerName: 'Bilbon', gender: 'FEMALE' }).where(eq(users.id, userId))
    await db.insert(items).values({ userId, item: 'CHEESE', obtainedAt: NOW })

    await resetPlayer(db, await loadPlayer(db, userId), NOW)

    expect(await db.select().from(items).where(eq(items.userId, userId))).toEqual([])
    expect(await loadPlayer(db, userId)).toMatchObject({ introDoneAt: null, adventurerName: null, gender: null })
  })

  // Michel redonne ses leçons à la partie neuve. Voir specs/admin.md#gestion-des-joueurs.
  it('remet les leçons du camp, de la chute, du rattrapage et du Grimoire à voir', async () => {
    await db.update(users).set({ campLessonAt: NOW, fallLessonAt: NOW, recoveryLessonAt: NOW, spellbookLessonAt: NOW, quillLessonAt: NOW, crystalBallLessonAt: NOW }).where(eq(users.id, userId))

    await resetPlayer(db, await loadPlayer(db, userId), NOW)

    expect(await loadPlayer(db, userId)).toMatchObject({ campLessonAt: null, fallLessonAt: null, recoveryLessonAt: null, spellbookLessonAt: null, quillLessonAt: null, crystalBallLessonAt: null })
  })

  it('ne laisse aucune attente derrière lui, durée comprise', async () => {
    await db
      .update(users)
      .set({ lives: 0, cooldownUntil: NOW, cooldownStartedAt: NOW, cooldownBaseMs: 1_000 })
      .where(eq(users.id, userId))

    await resetPlayer(db, await loadPlayer(db, userId), NOW)

    expect(await loadPlayer(db, userId)).toMatchObject({
      cooldownUntil: null,
      cooldownStartedAt: null,
      cooldownBaseMs: null,
    })
  })

  it('rend contestable une question déjà contestée, ratée de nouveau', async () => {
    await miss()
    await db.insert(disputes).values({
      userId,
      questionId,
      status: 'rejected',
      createdAt: NOW,
      settledAt: NOW,
    })

    await resetPlayer(db, await loadPlayer(db, userId), NOW)
    await miss()

    expect(await disputableErrors(db, await loadPlayer(db, userId)))
      .toMatchObject([{ questionId }])
  })
})
