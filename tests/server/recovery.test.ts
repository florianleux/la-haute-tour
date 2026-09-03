import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { missedPool, recoveryQuestions, seenQuestions, users } from '../../server/db/schema'
import { readGameState, readMissedPool, serveNextQuestion, submitAnswer } from '../../server/utils/game'
import { rulesForFloor } from '../../server/utils/rules'
import { createPlayer, createQuestion, createTestDatabase } from '../helpers/db'
import type { Database } from '../../server/db/client'
import type { User } from '../../server/db/schema'

const NOW = new Date('2026-09-03T12:00:00.000Z')
const rules = rulesForFloor(1)

describe('attente et rattrapage', () => {
  let db: Database
  let player: User

  beforeEach(async () => {
    db = await createTestDatabase()
    const id = await createPlayer(db, { lives: 0, cooldownUntil: new Date(NOW.getTime() + 1_000) })
    player = (await db.select().from(users).where(eq(users.id, id)))[0]
  })

  async function reload(): Promise<User> {
    return (await db.select().from(users).where(eq(users.id, player.id)))[0]
  }

  /** Fills the missed pool of floor 1 with `size` questions, oldest failure first. */
  async function fillPool(size: number): Promise<string[]> {
    const ids: string[] = []

    for (let i = 0; i < size; i++) {
      const questionId = await createQuestion(db, {
        statement: `Question ${i} ?`,
        answerLabel: `RÉPONSE ${i}`,
        accepted: [`reponse ${i}`],
      })
      await db.insert(seenQuestions).values({
        userId: player.id,
        questionId,
        floor: 1,
        correct: false,
      })
      await db.insert(missedPool).values({
        userId: player.id,
        questionId,
        floor: 1,
        lastFailedAt: new Date(NOW.getTime() - (size - i) * 60_000),
      })
      ids.push(questionId)
    }

    // Une question encore à voir : sans elle l'étage serait terminé et la reprise
    // mènerait au palier, pas à l'ascension.
    await createQuestion(db, { statement: 'Encore à voir ?' })

    return ids
  }

  const afterCooldown = new Date(NOW.getTime() + 2_000)

  describe('attente', () => {
    it('affiche le temps restant tant que l échéance n est pas atteinte', async () => {
      await fillPool(rules.poolSizeForRecovery)

      const state = await readGameState(db, player, NOW)

      expect(state.phase).toBe('cooldown')
      expect(state.cooldownUntil).toBe(new Date(NOW.getTime() + 1_000).toISOString())
    })

    it('rend les vies sans rattrapage quand le pool est trop maigre', async () => {
      await fillPool(rules.poolSizeForRecovery - 1)

      const state = await readGameState(db, player, afterCooldown)

      expect(state.phase).toBe('ascent')
      expect(state.lives).toBe(rules.lives)
      expect((await reload()).cooldownUntil).toBeNull()
    })

    it('passe au rattrapage quand le pool est assez fourni', async () => {
      await fillPool(rules.poolSizeForRecovery)

      const state = await readGameState(db, player, afterCooldown)

      expect(state.phase).toBe('recovery')
      expect(state.lives).toBe(0)
    })
  })

  describe('Pool Échecs affiché', () => {
    it('sert le pool avec les réponses, du dernier échec au plus ancien', async () => {
      await fillPool(3)

      const page = await readMissedPool(db, player, { limit: 10, offset: 0, order: 'desc' })

      expect(page.entries).toHaveLength(3)
      expect(page.entries[0]).toMatchObject({ statement: 'Question 2 ?', answerLabel: 'RÉPONSE 2' })
      expect(page.entries.at(-1)).toMatchObject({ statement: 'Question 0 ?' })
      expect(page.total).toBe(3)
    })

    it('inverse le tri à la demande', async () => {
      await fillPool(3)

      const page = await readMissedPool(db, player, { limit: 10, offset: 0, order: 'asc' })

      expect(page.entries[0]).toMatchObject({ statement: 'Question 0 ?' })
    })

    it('pagine par dix', async () => {
      await fillPool(12)

      const first = await readMissedPool(db, player, { limit: 10, offset: 0, order: 'desc' })
      const second = await readMissedPool(db, player, { limit: 10, offset: 10, order: 'desc' })

      expect(first.entries).toHaveLength(10)
      expect(second.entries).toHaveLength(2)
      expect(first.total).toBe(12)
    })
  })

  describe('déroulement du rattrapage', () => {
    beforeEach(async () => {
      await fillPool(rules.poolSizeForRecovery + 2)
    })

    it('tire des questions distinctes du pool et sert la première', async () => {
      const state = await serveNextQuestion(db, player, afterCooldown)

      expect(state.phase).toBe('recovery')
      expect(state.question).not.toBeNull()
      expect(state.question?.expiresAt).toBe(
        new Date(afterCooldown.getTime() + rules.recoveryTimerMs).toISOString(),
      )
      expect(state.recovery).toMatchObject({ total: rules.recoveryQuestions, played: 0, successes: 0 })

      const drawn = await db.select().from(recoveryQuestions)
      expect(drawn).toHaveLength(rules.recoveryQuestions)
      expect(new Set(drawn.map(row => row.questionId)).size).toBe(rules.recoveryQuestions)
    })

    it('ne tire que dans le pool de l étage courant', async () => {
      const otherFloor = await createQuestion(db, { floor: 3, statement: 'Autre étage ?' })
      await db.insert(missedPool).values({
        userId: player.id,
        questionId: otherFloor,
        floor: 3,
        lastFailedAt: NOW,
      })

      await serveNextQuestion(db, player, afterCooldown)

      const drawn = await db.select().from(recoveryQuestions)
      expect(drawn.map(row => row.questionId)).not.toContain(otherFloor)
    })

    /** Answers the question currently served, right or wrong. */
    async function answerServed(correct: boolean, at: Date): Promise<void> {
      const state = await readGameState(db, await reload(), at)
      const [question] = await db
        .select()
        .from(missedPool)
        .where(eq(missedPool.questionId, state.question?.id ?? ''))
      expect(question).toBeDefined()

      const index = Number((state.question?.statement ?? '').replace(/\D/g, ''))
      await submitAnswer(db, await reload(), correct ? `reponse ${index}` : 'nawak', at)
    }

    it('incrémente le compteur de la question sur une bonne réponse', async () => {
      const state = await serveNextQuestion(db, player, afterCooldown)
      const questionId = state.question?.id ?? ''

      await answerServed(true, afterCooldown)

      const [entry] = await db.select().from(missedPool).where(eq(missedPool.questionId, questionId))
      expect(entry.poolSuccesses).toBe(1)
    })

    it('sort la question du pool quand le seuil de réussites est atteint', async () => {
      const state = await serveNextQuestion(db, player, afterCooldown)
      const questionId = state.question?.id ?? ''
      await db
        .update(missedPool)
        .set({ poolSuccesses: rules.poolSuccessesToLeave - 1 })
        .where(eq(missedPool.questionId, questionId))

      await answerServed(true, afterCooldown)

      const rows = await db.select().from(missedPool).where(eq(missedPool.questionId, questionId))
      expect(rows).toHaveLength(0)
    })

    it('remet le compteur à zéro sur une mauvaise réponse et remonte la date d échec', async () => {
      const state = await serveNextQuestion(db, player, afterCooldown)
      const questionId = state.question?.id ?? ''
      await db
        .update(missedPool)
        .set({ poolSuccesses: 1 })
        .where(eq(missedPool.questionId, questionId))

      await answerServed(false, afterCooldown)

      const [entry] = await db.select().from(missedPool).where(eq(missedPool.questionId, questionId))
      expect(entry).toMatchObject({ poolSuccesses: 0, lastFailedAt: afterCooldown })
    })

    it('n annonce aucune vie perdue : le rattrapage n en coûte pas', async () => {
      await serveNextQuestion(db, player, afterCooldown)

      await answerServed(false, afterCooldown)
      const state = await readGameState(db, await reload(), afterCooldown)

      expect(state.verdict).toMatchObject({ correct: false, lifeLost: false })
      expect(state.lives).toBe(0)
    })

    it('ne fait avancer aucune progression d étage', async () => {
      const before = await db.select().from(seenQuestions)

      await serveNextQuestion(db, player, afterCooldown)
      await answerServed(true, afterCooldown)

      expect(await db.select().from(seenQuestions)).toHaveLength(before.length)
    })

    it('joue toutes les questions tirées, même après le seuil de réussite atteint', async () => {
      await serveNextQuestion(db, player, afterCooldown)

      for (let i = 0; i < rules.recoveryQuestions - 1; i++) {
        await answerServed(true, afterCooldown)
        const state = await serveNextQuestion(db, await reload(), afterCooldown)
        expect(state.phase).toBe('recovery')
        expect(state.question).not.toBeNull()
        expect(state.recovery).toMatchObject({ played: i + 1 })
      }
    })

    it('rend les vies dès qu une réponse a été juste, une fois tout joué', async () => {
      await serveNextQuestion(db, player, afterCooldown)
      await answerServed(true, afterCooldown)

      for (let i = 0; i < rules.recoveryQuestions - 1; i++) {
        await serveNextQuestion(db, await reload(), afterCooldown)
        await answerServed(false, afterCooldown)
      }

      const state = await serveNextQuestion(db, await reload(), afterCooldown)

      expect(state.phase).toBe('ascent')
      expect(state.lives).toBe(rules.lives)
      expect(await db.select().from(recoveryQuestions)).toHaveLength(0)
    })

    it('relance une attente plus courte quand rien n a été juste', async () => {
      await serveNextQuestion(db, player, afterCooldown)

      for (let i = 0; i < rules.recoveryQuestions; i++) {
        await answerServed(false, afterCooldown)
        await serveNextQuestion(db, await reload(), afterCooldown)
      }

      const state = await readGameState(db, await reload(), afterCooldown)

      expect(state.phase).toBe('cooldown')
      expect(state.lives).toBe(0)
      expect(state.cooldownUntil).toBe(
        new Date(afterCooldown.getTime() + rules.cooldownAfterFailedRecoveryMs).toISOString(),
      )
      expect(await db.select().from(recoveryQuestions)).toHaveLength(0)
    })
  })
})
