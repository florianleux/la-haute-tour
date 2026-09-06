import { beforeEach, describe, expect, it } from 'vitest'
import { attempts, disputes } from '../../server/db/schema'
import { closeAttempt, journeyStats } from '../../server/utils/journey'
import { createPlayer, createQuestion, createTestDatabase, loadPlayer, markSeen } from '../helpers/db'
import type { Database } from '../../server/db/client'
import type { User } from '../../server/db/schema'

const NOW = new Date('2026-09-04T12:00:00.000Z')

describe('parcours', () => {
  let db: Database
  let player: User

  beforeEach(async () => {
    db = await createTestDatabase()
    player = await loadPlayer(db, await createPlayer(db, { currentFloor: 1 }))
  })

  /** Une question vue, juste ou fausse, à la minute dite. */
  async function see(correct: boolean, minute: number, floor = 1): Promise<void> {
    const questionId = await createQuestion(db, { floor, statement: `Question ${minute} ?` })
    await markSeen(db, player.id, questionId, { floor, correct, seenAt: new Date(NOW.getTime() + minute * 60_000) })
  }

  describe('clôture d une tentative', () => {
    it('inscrit sa longueur en questions vues', async () => {
      await see(true, 1)
      await see(false, 2)

      // Relu : le joueur porte sa longueur de tentative, et la copie d'avant
      // les questions vues ne la connaît pas. Voir tests/helpers/db.ts.
      await closeAttempt(db, await loadPlayer(db, player.id), NOW)

      expect(await db.select().from(attempts)).toMatchObject([{
        userId: player.id,
        startedAt: player.attemptStartedAt,
        endedAt: NOW,
        seen: 2,
        floor: 1,
      }])
    })

    it('ne compte que les questions vues depuis le début de la tentative', async () => {
      await see(true, 1)
      const later = await loadPlayer(db, player.id)
      later.attemptStartedAt = new Date(NOW.getTime() + 90_000)
      await see(false, 2)

      await closeAttempt(db, later, NOW)

      expect((await db.select().from(attempts))[0].seen).toBe(1)
    })

    it('n inscrit rien quand aucune question n a été vue', async () => {
      // Relu : le joueur porte sa longueur de tentative, et la copie d'avant
      // les questions vues ne la connaît pas. Voir tests/helpers/db.ts.
      await closeAttempt(db, await loadPlayer(db, player.id), NOW)

      expect(await db.select().from(attempts)).toHaveLength(0)
    })
  })

  describe('statistiques', () => {
    it('rend un parcours vide au joueur qui n a rien vu', async () => {
      expect(await journeyStats(db, player)).toMatchObject({
        floor: 1,
        floorSeen: 0,
        seen: 0,
        correct: 0,
        bestStreak: 0,
        attempts: 0,
        longestAttempt: null,
        shortestAttempt: null,
        disputes: 0,
        disputesWon: 0,
      })
    })

    it('compte les questions vues et les bonnes réponses', async () => {
      await see(true, 1)
      await see(false, 2)
      await see(true, 3)

      const stats = await journeyStats(db, player)

      expect(stats).toMatchObject({ seen: 3, correct: 2, floorSeen: 3, floorTotal: 3 })
    })

    it('ne compte dans l étage que les questions vues à cet étage', async () => {
      await see(true, 1, 1)
      await see(true, 2, 2)
      const climbed = { ...player, currentFloor: 2 }

      expect(await journeyStats(db, climbed)).toMatchObject({ seen: 2, floorSeen: 1 })
    })

    it('rend la plus longue série de bonnes réponses, pas la dernière', async () => {
      await see(true, 1)
      await see(true, 2)
      await see(true, 3)
      await see(false, 4)
      await see(true, 5)

      expect((await journeyStats(db, player)).bestStreak).toBe(3)
    })

    it('rend la plus longue et la plus courte tentative achevée', async () => {
      await db.insert(attempts).values([
        { userId: player.id, startedAt: NOW, endedAt: NOW, seen: 12, floor: 1 },
        { userId: player.id, startedAt: NOW, endedAt: NOW, seen: 3, floor: 1 },
        { userId: player.id, startedAt: NOW, endedAt: NOW, seen: 7, floor: 2 },
      ])

      expect(await journeyStats(db, player)).toMatchObject({
        attempts: 3,
        longestAttempt: 12,
        shortestAttempt: 3,
      })
    })

    it('ne compte comme gagnées que les contestations acceptées', async () => {
      const first = await createQuestion(db, { statement: 'A ?' })
      const second = await createQuestion(db, { statement: 'B ?' })
      const third = await createQuestion(db, { statement: 'C ?' })
      await db.insert(disputes).values([
        { userId: player.id, questionId: first, status: 'accepted', createdAt: NOW },
        { userId: player.id, questionId: second, status: 'rejected', createdAt: NOW },
        { userId: player.id, questionId: third, status: 'pending', createdAt: NOW },
      ])

      expect(await journeyStats(db, player)).toMatchObject({ disputes: 3, disputesWon: 1 })
    })

    it('ne mélange pas les parcours de deux joueurs', async () => {
      await see(true, 1)
      const other = await loadPlayer(db, await createPlayer(db, { discordId: '999', username: 'saruman' }))

      expect((await journeyStats(db, other)).seen).toBe(0)
    })
  })
})
