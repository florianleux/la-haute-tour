import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { activeEffects, inventory, missedPool, recoveryQuestions, users } from '../../server/db/schema'
import { readGameState, serveNextQuestion, submitAnswer } from '../../server/utils/game'
import { castSpell } from '../../server/utils/effects'
import { grantLife } from '../../server/utils/lives'
import { rulesForFloor } from '../../server/utils/rules'
import { createPlayer, createQuestion, createTestDatabase, loadPlayer, markSeen } from '../helpers/db'
import { installNitroGlobals } from '../helpers/nitro'
import type { Database } from '../../server/db/client'
import type { User } from '../../server/db/schema'

installNitroGlobals()

const NOW = new Date('2026-09-05T12:00:00.000Z')
const rules = rulesForFloor(1)

describe('Vitalité, du lancer à la tentative suivante', () => {
  let db: Database
  let player: User

  beforeEach(async () => {
    db = await createTestDatabase()
    const id = await createPlayer(db, { lives: 0, cooldownUntil: new Date(NOW.getTime() + 1_000) })
    player = await loadPlayer(db, id)
    // Une question encore à voir : sans elle l'étage serait fini, et le palier
    // primerait sur l'attente.
    await createQuestion(db, { statement: 'Encore à voir ?', accepted: ['oui'] })
  })

  const reload = (): Promise<User> => loadPlayer(db, player.id)

  /** Un exemplaire en poche, puis lancé sur soi pendant l'attente. */
  async function castVitality(): Promise<void> {
    await db.insert(inventory).values({ userId: player.id, spell: 'VITALITY', obtainedAt: NOW })
    await castSpell(db, await reload(), 'VITALITY', NOW)
  }

  /** Remplit le Pool Échecs, et laisse une question encore à voir à l'étage. */
  async function fillPool(size: number): Promise<void> {
    for (let i = 0; i < size; i++) {
      const questionId = await createQuestion(db, { statement: `Ratée ${i} ?`, accepted: [`reponse ${i}`] })
      await markSeen(db, player.id, questionId, { floor: 1, correct: false })
      await db.insert(missedPool).values({
        userId: player.id,
        questionId,
        floor: 1,
        lastFailedAt: new Date(NOW.getTime() - 60_000),
      })
    }
  }

  const afterCooldown = new Date(NOW.getTime() + 2_000)

  describe('ce que le joueur lit', () => {
    it('récapitule pendant l attente ce qui attend sa prochaine tentative', async () => {
      await castVitality()

      const state = await readGameState(db, await reload(), NOW)

      expect(state.phase).toBe('cooldown')
      expect(state.effects).toEqual([
        { spell: 'VITALITY', face: 'boon', casterName: 'gandalf', state: 'pending' },
      ])
    })

    it('montre l effet actif pendant l ascension qu il a ouverte', async () => {
      await castVitality()
      await fillPool(rules.poolSizeForRecovery - 1)

      const state = await readGameState(db, await reload(), afterCooldown)

      expect(state.phase).toBe('ascent')
      expect(state.effects).toEqual([
        { spell: 'VITALITY', face: 'boon', casterName: 'gandalf', state: 'active' },
      ])
    })

    it('ne montre rien quand rien n est posé', async () => {
      expect((await readGameState(db, player, NOW)).effects).toEqual([])
    })
  })

  describe('ancrage sur la tentative suivante', () => {
    it('ouvre la tentative avec une vie de plus quand le pool est trop maigre', async () => {
      await castVitality()
      await fillPool(rules.poolSizeForRecovery - 1)

      await readGameState(db, await reload(), afterCooldown)

      expect((await reload()).lives).toBe(rules.lives + 1)
    })

    it('ouvre avec une vie de plus la tentative rendue par un rattrapage réussi', async () => {
      await castVitality()
      await fillPool(rules.poolSizeForRecovery)

      // L'attente s'achève, le rattrapage se joue jusqu'au bout : toutes ses
      // questions se jouent, une seule bonne réponse suffit à repartir.
      await serveNextQuestion(db, await reload(), afterCooldown)

      for (let i = 0; i < rules.recoveryQuestions; i++) {
        const served = await readGameState(db, await reload(), afterCooldown)
        const index = Number((served.question?.statement ?? '').replace(/\D/g, ''))
        await submitAnswer(db, await reload(), `reponse ${index}`, afterCooldown)
        await serveNextQuestion(db, await reload(), afterCooldown)
      }

      expect((await reload()).lives).toBe(rules.lives + 1)
    })

    it('additionne deux Vitalité posées avant la même tentative', async () => {
      const other = await createPlayer(db, { discordId: '987654321', username: 'radagast' })
      await castVitality()
      await db.insert(activeEffects).values({
        userId: player.id,
        casterId: other,
        spell: 'VITALITY',
        face: 'boon',
        castAt: NOW,
        castCooldownUntil: new Date(NOW.getTime() + 1_000),
      })
      await fillPool(rules.poolSizeForRecovery - 1)

      await readGameState(db, await reload(), afterCooldown)

      expect((await reload()).lives).toBe(rules.lives + 2)
    })

    it('meurt avec la tentative qu il a ouverte : la suivante repart des règles de l étage', async () => {
      await castVitality()
      await fillPool(rules.poolSizeForRecovery - 1)
      await readGameState(db, await reload(), afterCooldown)

      // La tentative s'achève à son tour : plus de vies, plus d'effet.
      const later = new Date(afterCooldown.getTime() + 60_000)
      await db
        .update(users)
        .set({ lives: 0, cooldownUntil: new Date(later.getTime() + 1_000) })
        .where(eq(users.id, player.id))
      await db.delete(recoveryQuestions).where(eq(recoveryQuestions.userId, player.id))

      const reopened = new Date(later.getTime() + 2_000)
      await readGameState(db, await reload(), reopened)

      expect((await reload()).lives).toBe(rules.lives)
      expect((await readGameState(db, await reload(), reopened)).effects).toEqual([])
    })
  })

  describe('ce qui ne réveille pas un effet', () => {
    it('laisse l effet en attente quand une contestation rend une vie', async () => {
      await castVitality()

      await grantLife(db, await reload())

      const state = await readGameState(db, await reload(), NOW)
      expect((await reload()).lives).toBe(1)
      expect(state.effects).toEqual([
        { spell: 'VITALITY', face: 'boon', casterName: 'gandalf', state: 'pending' },
      ])
    })
  })
})
