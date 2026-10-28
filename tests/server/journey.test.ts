import { beforeEach, describe, expect, it } from 'vitest'
import { attempts } from '../../server/db/schema'
import { closeAttempt } from '../../server/utils/journey'
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
})
