import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { missedPool, reservations, users } from '../../server/db/schema'
import { FLOOR_COUNT } from '../../shared/utils/floors'
import { readGameState, serveNextQuestion, submitAnswer } from '../../server/utils/game'
import { createPlayer, createQuestion, createTestDatabase, loadPlayer, markSeen } from '../helpers/db'
import type { Database } from '../../server/db/client'
import type { User } from '../../server/db/schema'

const NOW = new Date('2026-09-03T12:00:00.000Z')

describe('palier et fin de partie', () => {
  let db: Database
  let player: User

  beforeEach(async () => {
    db = await createTestDatabase()
    const id = await createPlayer(db)
    player = await loadPlayer(db, id)
  })

  const reload = (): Promise<User> => loadPlayer(db, player.id)

  /** Une question de l'étage, déjà vue : c'est le décompte qui fait le palier. */
  async function seeQuestion(floor: number): Promise<string> {
    const questionId = await createQuestion(db, { floor, statement: `Question de l étage ${floor} ?` })
    await markSeen(db, player.id, questionId, { floor })
    return questionId
  }

  /** Le boss de l'étage battu, sa victoire à lire. Voir tests/server/boss-fight.test.ts. */
  async function beatBoss(): Promise<void> {
    await db.update(users).set({ bossHp: 0 }).where(eq(users.id, player.id))
    player = await reload()
  }

  async function standOn(floor: number): Promise<void> {
    await db.update(users).set({ currentFloor: floor }).where(eq(users.id, player.id))
    player = await reload()
  }

  describe('palier', () => {
    beforeEach(async () => {
      await seeQuestion(1)
      await createQuestion(db, { floor: 2, statement: 'Question de l étage 2 ?' })
    })

    it('annonce le palier quand toutes les questions de l étage sont vues', async () => {
      const state = await readGameState(db, player, NOW)

      expect(state).toMatchObject({ phase: 'bossDoor', floor: 1 })
      expect(state.question).toBeNull()
    })

    it('franchit le palier sur la victoire : l étage suivant, sa première question réservée', async () => {
      await beatBoss()
      const state = await serveNextQuestion(db, player, NOW)

      expect(state).toMatchObject({ phase: 'ascent', floor: 2 })
      expect(state.question?.statement).toBe('Question de l étage 2 ?')
      expect((await reload()).currentFloor).toBe(2)
    })

    it('réaffiche le palier au rafraîchissement, sans le franchir ni le sauter', async () => {
      await readGameState(db, player, NOW)
      const again = await readGameState(db, await reload(), new Date(NOW.getTime() + 60_000))

      expect(again).toMatchObject({ phase: 'bossDoor', floor: 1 })
      expect((await reload()).currentFloor).toBe(1)
      expect(await db.select().from(reservations)).toHaveLength(0)
    })

    it('abandonne le Pool Échecs de l étage quitté', async () => {
      // Une question du pool est toujours une question vue : elle y est entrée en
      // se résolvant.
      const missedId = await seeQuestion(1)
      await db.insert(missedPool).values({
        userId: player.id,
        questionId: missedId,
        floor: 1,
        lastFailedAt: NOW,
      })
      await beatBoss()

      await serveNextQuestion(db, player, NOW)

      expect(await db.select().from(missedPool)).toHaveLength(0)
    })
  })

  describe('étage épuisé sans vie', () => {
    /** Plus de vies, une attente en cours — celle d'une défaite au boss —, et un Pool Échecs bien fourni. */
    async function outOfLivesWithPool(floor: number): Promise<void> {
      for (let i = 0; i < 3; i++) {
        const questionId = await seeQuestion(floor)
        await db.insert(missedPool).values({
          userId: player.id,
          questionId,
          floor,
          lastFailedAt: NOW,
        })
      }

      await db
        .update(users)
        .set({ lives: 0, cooldownUntil: new Date(NOW.getTime() + 60_000) })
        .where(eq(users.id, player.id))
      player = await reload()
    }

    // specs/boss.md#tentatives-et-difficulté : une défaite attend avant de
    // remonter à la porte.
    it('mène à l attente, pas au palier', async () => {
      await outOfLivesWithPool(1)
      await createQuestion(db, { floor: 2, statement: 'Question de l étage 2 ?' })

      const state = await readGameState(db, player, NOW)

      expect(state.phase).toBe('cooldown')
      expect(await db.select().from(missedPool)).toHaveLength(3)
    })

    it('ne franchit rien tant que l attente court', async () => {
      await outOfLivesWithPool(1)
      await createQuestion(db, { floor: 2, statement: 'Question de l étage 2 ?' })

      const state = await serveNextQuestion(db, player, NOW)

      expect(state).toMatchObject({ phase: 'cooldown', floor: 1, lives: 0 })
      expect(await db.select().from(reservations)).toHaveLength(0)
    })

    // specs/boss.md#cas-à-0-vie : la dernière vie perdue sur la dernière
    // question n'est pas une chute, elle mène au palier.
    it('mène au palier, sans attente, dès le verdict de la dernière question', async () => {
      await createQuestion(db, { floor: 1, statement: 'Dernière de l étage ?' })
      await createQuestion(db, { floor: 2, statement: 'Question de l étage 2 ?' })
      await db.update(users).set({ lives: 1 }).where(eq(users.id, player.id))
      await serveNextQuestion(db, await reload(), NOW)

      const state = await submitAnswer(db, await reload(), 'Toulouse', new Date(NOW.getTime() + 1_000))

      expect(state).toMatchObject({ phase: 'floorEnd', floor: 1, lives: 0, cooldownUntil: null })
      expect(state.verdict).toMatchObject({ correct: false, lifeLost: true })
    })

    it('mène à l attente au dernier étage aussi : son boss l attend', async () => {
      await standOn(FLOOR_COUNT)
      await outOfLivesWithPool(FLOOR_COUNT)

      const state = await readGameState(db, player, NOW)

      expect(state.phase).toBe('cooldown')
    })
  })

  // Un deck réduit, importé sur le seul premier étage : au bout, pas de palier
  // vers un étage vide. Voir specs/spec.md#glossaire (Fin du deck).
  describe('fin du deck', () => {
    beforeEach(async () => {
      await seeQuestion(1)
    })

    it('annonce la fin du deck quand l étage d au-dessus est vide', async () => {
      const state = await readGameState(db, player, NOW)

      expect(state).toMatchObject({ phase: 'deckEnd', floor: 1 })
    })

    it('ne franchit rien : le joueur reste à son étage, sans question', async () => {
      const state = await serveNextQuestion(db, player, NOW)

      expect(state).toMatchObject({ phase: 'deckEnd', floor: 1 })
      expect(state.question).toBeNull()
      expect((await reload()).currentFloor).toBe(1)
      expect(await db.select().from(reservations)).toHaveLength(0)
    })
  })

  describe('fin de partie', () => {
    beforeEach(async () => {
      await standOn(FLOOR_COUNT)
      await seeQuestion(FLOOR_COUNT)
      await beatBoss()
    })

    it('annonce la fin quand le boss du dernier étage est battu', async () => {
      const state = await readGameState(db, player, NOW)

      expect(state).toMatchObject({ phase: 'gameOver', floor: FLOOR_COUNT })
    })

    it('est terminale : rien à franchir, rien à réserver', async () => {
      const state = await serveNextQuestion(db, player, NOW)

      expect(state).toMatchObject({ phase: 'gameOver', floor: FLOOR_COUNT })
      expect(state.question).toBeNull()
      expect((await reload()).currentFloor).toBe(FLOOR_COUNT)
      expect(await db.select().from(reservations)).toHaveLength(0)
    })

    it('n empêche pas la fin quand le Pool Échecs du dernier étage n est pas vide', async () => {
      const missedId = await createQuestion(db, { floor: FLOOR_COUNT, statement: 'Ratée au sommet ?' })
      await markSeen(db, player.id, missedId, { floor: FLOOR_COUNT, correct: false })
      await db.insert(missedPool).values({
        userId: player.id,
        questionId: missedId,
        floor: FLOOR_COUNT,
        lastFailedAt: NOW,
      })

      const state = await readGameState(db, player, NOW)

      expect(state.phase).toBe('gameOver')
    })
  })
})
