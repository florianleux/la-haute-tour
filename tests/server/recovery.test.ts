import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { activeEffects, attempts, missedPool, recoveryQuestions, reservations, seenQuestions } from '../../server/db/schema'
import { requireCamp } from '../../server/utils/camp'
import { readGameState, serveNextQuestion, submitAnswer } from '../../server/utils/game'
import { rulesForFloor } from '../../server/utils/rules'
import { createPlayer, createQuestion, createTestDatabase, loadPlayer, markSeen } from '../helpers/db'
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
    player = await loadPlayer(db, id)
  })

  const reload = (): Promise<User> => loadPlayer(db, player.id)

  /** Fills the missed pool of floor 1 with `size` questions, oldest failure first. */
  async function fillPool(size: number): Promise<string[]> {
    const ids: string[] = []

    for (let i = 0; i < size; i++) {
      const questionId = await createQuestion(db, {
        statement: `Question ${i} ?`,
        answerLabel: `RÉPONSE ${i}`,
        accepted: [`reponse ${i}`],
      })
      await markSeen(db, player.id, questionId, { floor: 1, correct: false })
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

  /** Une Vitalité noire qui attend la prochaine tentative du joueur. */
  async function curseNextAttempt(): Promise<void> {
    const caster = await createPlayer(db, { discordId: 'saroumane', username: 'saroumane' })
    await db.insert(activeEffects).values({
      userId: player.id,
      casterId: caster,
      spell: 'VITALITY',
      face: 'curse',
      castAt: NOW,
      castCooldownStartedAt: NOW,
    })
  }

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
      // La reprise ouvre une tentative, donc elle en clôt une : sa longueur est
      // inscrite pour le parcours. Voir specs/ecrans.md#profil.
      expect(await db.select().from(attempts))
        .toMatchObject([{ seen: rules.poolSizeForRecovery - 1 }])
    })

    it('reprend au repos, sans le verdict de la chute déjà lu, quand le pool est trop maigre', async () => {
      const [fatal] = await fillPool(rules.poolSizeForRecovery - 1)
      // La question de la chute, déjà résolue et lue avant de redescendre.
      await db.insert(reservations).values({
        userId: player.id,
        questionId: fatal ?? '',
        mode: 'ascent',
        expiresAt: NOW,
        createdAt: NOW,
        resolvedAt: NOW,
        correct: false,
        submittedAnswer: 'nawak',
      })

      const state = await readGameState(db, player, afterCooldown)

      expect(state.phase).toBe('ascent')
      expect(state.verdict).toBeNull()
      expect(state.question).toBeNull()
      // Au repos, le camp s'ouvre : Grimoire, Volumen et Sorts.
      await expect(requireCamp(db, await reload(), afterCooldown)).resolves.toBeUndefined()
    })

    // Deux onglets qui relisent l'état au bout de l'attente voient tous deux la
    // tentative à ouvrir. Une seule doit l'ouvrir : la seconde effaçait la
    // Vitalité noire que la première venait d'ancrer.
    // Voir server/utils/journey.ts#openAttempt.
    it('n ouvre qu une tentative quand deux lectures arrivent ensemble', async () => {
      await fillPool(rules.poolSizeForRecovery - 1)
      await curseNextAttempt()

      await Promise.all([
        readGameState(db, player, afterCooldown),
        readGameState(db, player, new Date(afterCooldown.getTime() + 1_000)),
      ])

      expect((await reload()).lives).toBe(rules.lives - 1)
      expect(await db.select().from(attempts)).toHaveLength(1)
      expect((await readGameState(db, await reload(), afterCooldown)).effects)
        .toMatchObject([{ spell: 'VITALITY', face: 'curse', state: 'active' }])
    })

    it('passe au rattrapage quand le pool est assez fourni', async () => {
      await fillPool(rules.poolSizeForRecovery)

      const state = await readGameState(db, player, afterCooldown)

      expect(state.phase).toBe('recovery')
      expect(state.lives).toBe(0)
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

    // Deux « Commencer » partis ensemble au bout de l'attente : chacun tirait son
    // rattrapage, et la seconde pose échouait ou doublait le tirage.
    it('ne tire qu un rattrapage quand deux requêtes le commencent ensemble', async () => {
      const [first, second] = await Promise.all([
        serveNextQuestion(db, player, afterCooldown),
        serveNextQuestion(db, player, afterCooldown),
      ])

      expect(await db.select().from(recoveryQuestions)).toHaveLength(rules.recoveryQuestions)
      expect(second.recovery).toEqual(first.recovery)
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

    // Un double envoi : les deux lisent la question encore en main. La seconde
    // ne doit ni retourner le verdict ni faire bouger le compteur une fois de
    // plus. Voir server/utils/game.ts#resolve.
    it('ne garde que la première de deux réponses parties ensemble', async () => {
      const state = await serveNextQuestion(db, player, afterCooldown)
      const questionId = state.question?.id ?? ''
      const index = Number((state.question?.statement ?? '').replace(/\D/g, ''))
      const holding = await reload()

      await Promise.all([
        submitAnswer(db, holding, 'nawak', afterCooldown),
        submitAnswer(db, holding, `reponse ${index}`, afterCooldown),
      ])

      const [entry] = await db.select().from(missedPool).where(eq(missedPool.questionId, questionId))
      expect(entry.poolSuccesses).toBe(0)
      const [played] = await db.select().from(recoveryQuestions).where(eq(recoveryQuestions.questionId, questionId))
      expect(played.correct).toBe(false)
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

    it('s arrête dès le quota atteint et enchaîne sur l ascension', async () => {
      await serveNextQuestion(db, player, afterCooldown)

      // Une bonne réponse suffit (seuil = 1) : le verdict est scellé, les
      // questions restantes ne se jouent pas, l'ascension reprend directement.
      await answerServed(true, afterCooldown)

      const state = await serveNextQuestion(db, await reload(), afterCooldown)

      expect(state.phase).toBe('ascent')
      expect(state.lives).toBe(rules.lives)
      expect(state.question).not.toBeNull()
      expect(await db.select().from(recoveryQuestions)).toHaveLength(0)
      expect(await db.select().from(attempts)).toHaveLength(1)
    })

    // Deux « Reprendre » partis ensemble au bout d'un rattrapage réussi : la
    // seconde requête rouvrait la tentative sans la malédiction déjà ancrée,
    // et l'inscrivait deux fois. Voir server/utils/journey.ts#openAttempt.
    it('ne passe qu une fois à la tentative suivante', async () => {
      await curseNextAttempt()
      await serveNextQuestion(db, player, afterCooldown)
      await answerServed(true, afterCooldown)
      const sealed = await reload()

      await Promise.all([
        serveNextQuestion(db, sealed, afterCooldown),
        serveNextQuestion(db, sealed, new Date(afterCooldown.getTime() + 1_000)),
      ])

      expect((await reload()).lives).toBe(rules.lives - 1)
      expect(await db.select().from(attempts)).toHaveLength(1)
      const state = await readGameState(db, await reload(), afterCooldown)
      expect(state.question).not.toBeNull()
      expect(state.effects).toMatchObject([{ spell: 'VITALITY', face: 'curse', state: 'active' }])
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
      // Une attente de plus prolonge la tentative : aucune n'est close.
      expect(await db.select().from(attempts)).toHaveLength(0)
    })
  })
})
