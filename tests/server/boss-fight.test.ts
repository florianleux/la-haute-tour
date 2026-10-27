import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { activeEffects, attempts, bossTrials, missedPool, reservations, users } from '../../server/db/schema'
import { FLOOR_COUNT } from '../../shared/utils/floors'
import { enterBoss, readGameState, serveNextQuestion, submitAnswer } from '../../server/utils/game'
import { rulesForFloor } from '../../server/utils/rules'
import { rewindTestPlayer, sendToCooldown } from '../../server/utils/testPlayers'
import { seedFlags } from '../../scripts/seed-flags'
import { createPlayer, createQuestion, createTestDatabase, loadPlayer, markSeen } from '../helpers/db'
import type { Database } from '../../server/db/client'
import type { GameState } from '../../server/utils/game'
import type { User } from '../../server/db/schema'

const NOW = new Date('2026-09-03T12:00:00.000Z')
const rules = rulesForFloor(1)

/** Dix drapeaux par combat, six combats : l'image dit la réponse au test, jamais au joueur. */
const FLAGS = Array.from({ length: 60 }, (_, index) => ({
  slug: `drapeau-${index}`,
  image: index.toString(16).padStart(16, '0'),
  bossAttemptNumber: Math.floor(index / 10) + 1,
  answerLabel: `Le pays ${index}`,
  acceptedAnswers: [`Pays ${index}`],
}))

function answerOf(state: GameState): string {
  const image = state.boss?.trial?.image
  return FLAGS.find(flag => flag.image === image)!.acceptedAnswers[0]!
}

// specs/boss.md : le combat de boss, une tentative de plus.
describe('combat de boss', () => {
  let db: Database
  let player: User
  let clock: number

  beforeEach(async () => {
    db = await createTestDatabase()
    await seedFlags(db, FLAGS)
    player = await loadPlayer(db, await createPlayer(db))
    clock = NOW.getTime()
    // L'étage 1 vu en entier, un étage 2 où monter.
    await markSeen(db, player.id, await createQuestion(db, { floor: 1 }), { floor: 1 })
    await createQuestion(db, { floor: 2, statement: 'Question de l étage 2 ?' })
  })

  const reload = (): Promise<User> => loadPlayer(db, player.id)
  const tick = (): Date => new Date(clock += 1_000)
  const next = async (): Promise<GameState> => serveNextQuestion(db, await reload(), tick())
  /** « Entrer », au terme de la porte et de l'introduction. */
  const enter = async (): Promise<GameState> => enterBoss(db, await reload(), tick())
  const answer = async (text: string): Promise<GameState> => submitAnswer(db, await reload(), text, tick())

  async function set(values: Partial<User>): Promise<void> {
    await db.update(users).set(values).where(eq(users.id, player.id))
  }

  /** Bonnes réponses d'affilée, chacune suivie de « Suivant ». */
  async function winTrials(count: number, state: GameState): Promise<GameState> {
    for (let index = 0; index < count; index++) {
      state = await answer(answerOf(state))
      if (state.boss?.outcome === null) {
        state = await next()
      }
    }
    return state
  }

  async function pendingVitality(): Promise<void> {
    const caster = await createPlayer(db, { discordId: '987654321', username: 'radagast' })
    await db.insert(activeEffects).values({
      userId: player.id,
      casterId: caster,
      spell: 'VITALITY',
      face: 'boon',
      castAt: NOW,
      castCooldownStartedAt: NOW,
    })
  }

  it('s ouvre sur « Entrer », et sert sa première épreuve sans ce qui la valide', async () => {
    const state = await enter()

    expect(state.phase).toBe('bossFight')
    expect(state.boss).toMatchObject({ hp: rules.bossHp, maxHp: rules.bossHp, verdict: null, outcome: null })
    expect(state.boss?.trial?.expiresAt).toBe(new Date(clock + rules.bossTrialTimerMs).toISOString())
    expect(await db.select().from(bossTrials)).toHaveLength(10)
    expect((await reload()).bossAttemptNumber).toBe(1)
    // #131 : ni la réponse ni son libellé ne partent avant le verdict.
    expect(JSON.stringify(state)).not.toMatch(/Pays \d|Le pays/)
  })

  it('quitte d abord le verdict de la dernière question : le joueur arrive devant la porte', async () => {
    const last = await createQuestion(db, { floor: 1 })
    // La première de l'étage est déjà vue : le curseur la dépasse.
    await set({ floorCursor: 1 })
    await serveNextQuestion(db, await reload(), NOW)
    const verdict = await submitAnswer(db, await reload(), 'BORDEAUX', tick())
    expect(verdict).toMatchObject({ phase: 'floorEnd' })
    expect(verdict.verdict?.questionId).toBe(last)

    const door = await next()

    expect(door).toMatchObject({ phase: 'floorEnd', verdict: null, boss: null })
    expect(await db.select().from(reservations)).toHaveLength(0)
    // Un « Suivant » en retard ne lance pas le combat sous la porte : seul
    // « Entrer » l'ouvre.
    expect((await next()).phase).toBe('floorEnd')
    expect((await enter()).phase).toBe('bossFight')
  })

  it("n ouvre le combat qu au palier, et qu une fois", async () => {
    await enter()
    const before = await db.select().from(bossTrials)

    expect((await enter()).phase).toBe('bossFight')
    expect(await db.select().from(bossTrials)).toEqual(before)
    expect((await reload()).bossAttemptNumber).toBe(1)
  })

  it('inscrit au parcours l ascension qui a mené au palier', async () => {
    await set({ attemptSeen: 4 })

    await enter()

    expect(await db.select().from(attempts)).toMatchObject([{ userId: player.id, seen: 4, floor: 1 }])
  })

  it('entre avec trois vies au plus : une vie de Vitalité ne passe pas la porte', async () => {
    await set({ lives: rules.lives + 1 })

    const state = await enter()

    expect(state).toMatchObject({ lives: rules.lives, maxLives: rules.lives })
  })

  it('retire un PV au boss sur une épreuve juste, puis sert la suivante', async () => {
    const fight = await enter()

    const judged = await answer(answerOf(fight))

    expect(judged.boss).toMatchObject({ hp: rules.bossHp - 1, trial: null, outcome: null })
    expect(judged.boss?.verdict).toMatchObject({ correct: true, image: fight.boss?.trial?.image })
    expect(judged.lives).toBe(rules.lives)
    expect((await next()).boss?.trial?.image).not.toBe(fight.boss?.trial?.image)
  })

  it('retire une vie au joueur sur une épreuve fausse, réponse montrée', async () => {
    const fight = await enter()

    const judged = await answer('Atlantide')

    expect(judged.lives).toBe(rules.lives - 1)
    expect(judged.boss?.hp).toBe(rules.bossHp)
    expect(judged.boss?.verdict).toMatchObject({
      correct: false,
      submittedAnswer: 'Atlantide',
      answerLabel: FLAGS.find(flag => flag.image === fight.boss?.trial?.image)!.answerLabel,
    })
  })

  it('compte fausse une épreuve dont le chrono est tombé, à la lecture', async () => {
    await enter()

    const state = await readGameState(db, await reload(), new Date(clock + rules.bossTrialTimerMs + rules.latencyGraceMs + 1))

    expect(state.lives).toBe(rules.lives - 1)
    expect(state.boss?.verdict).toMatchObject({ correct: false, submittedAnswer: '' })
  })

  it('ne juge pas deux fois la même épreuve', async () => {
    await enter()
    const user = await reload()

    await Promise.all([submitAnswer(db, user, 'Atlantide', tick()), submitAnswer(db, user, 'Atlantide', tick())])

    expect((await reload()).lives).toBe(rules.lives - 1)
  })

  describe('défaite', () => {
    async function lose(): Promise<GameState> {
      let state = await enter()
      for (let life = rules.lives; life > 0; life--) {
        state = await answer('Atlantide')
        if (life > 1) {
          state = await next()
        }
      }
      return state
    }

    it('rend le joueur au camp, en attente : le boss garde ses PV, le combat s efface', async () => {
      const state = await lose()

      expect(state).toMatchObject({ phase: 'cooldown', lives: 0 })
      expect(state.cooldownUntil).not.toBeNull()
      expect(state.boss).toMatchObject({ outcome: 'defeat', hp: rules.bossHp, trial: null })
      expect((await reload()).bossHp).toBeNull()
    })

    it('rouvre le palier au bout de l attente, et le combat suivant à vies pleines', async () => {
      await lose()
      // Pool Échecs trop maigre : l'attente échue rend les vies.
      const afterCooldown = new Date(clock + rules.cooldownMs + 1)

      expect((await readGameState(db, await reload(), afterCooldown)).phase).toBe('floorEnd')

      clock = afterCooldown.getTime()
      const again = await enter()
      expect(again).toMatchObject({ phase: 'bossFight', lives: rules.lives })
      expect(again.boss).toMatchObject({ hp: rules.bossHp, verdict: null })
      expect((await reload()).bossAttemptNumber).toBe(2)
    })

    it('sert au combat suivant les drapeaux de son numéro : la difficulté baisse', async () => {
      await set({ bossAttemptNumber: 3 })

      await enter()

      const drawn = await db.select().from(bossTrials)
      expect(drawn).toHaveLength(10)
      expect(new Set(drawn.map(trial => FLAGS.find(flag => flag.slug === trial.flagSlug)!.bossAttemptNumber))).toEqual(new Set([4]))
    })

    it('au 6e combat perdu, le boss laisse passer : ni outro ni attente, « Continuer » franchit le palier', async () => {
      await set({ bossAttemptNumber: 5 })

      const passed = await lose()

      expect(passed).toMatchObject({ phase: 'bossFight', lives: 0, cooldownUntil: null, recovery: null, nextRecovery: null })
      expect(passed.boss).toMatchObject({ outcome: 'passed', hp: rules.bossHp, trial: null })

      const climbed = await next()

      expect(climbed).toMatchObject({ phase: 'ascent', floor: 2, lives: rules.lives })
      expect(climbed.question?.statement).toBe('Question de l étage 2 ?')
      expect(await reload()).toMatchObject({ bossHp: null, bossAttemptNumber: 0 })
    })

    it('rouvre encore le dernier combat à qui en a déjà perdu six, plutôt que de le bloquer au palier', async () => {
      await set({ bossAttemptNumber: 6 })

      expect((await enter()).phase).toBe('bossFight')
      const drawn = await db.select().from(bossTrials)
      expect(new Set(drawn.map(trial => FLAGS.find(flag => flag.slug === trial.flagSlug)!.bossAttemptNumber))).toEqual(new Set([6]))
    })

    it('au 6e combat perdu du dernier étage, la partie s achève', async () => {
      await set({ currentFloor: FLOOR_COUNT, bossAttemptNumber: 5 })
      await markSeen(db, player.id, await createQuestion(db, { floor: FLOOR_COUNT }), { floor: FLOOR_COUNT })

      const passed = await lose()

      expect(passed.phase).toBe('gameOver')
      expect(passed.boss?.outcome).toBe('passed')
    })

    it('ne consomme pas un effet en attente : ni à l entrée, ni à la reprise d avant combat', async () => {
      await pendingVitality()
      await lose()
      await readGameState(db, await reload(), new Date(clock + rules.cooldownMs + 1))

      const [effect] = await db.select().from(activeEffects)
      expect(effect?.anchoredAt).toBeNull()
      expect((await reload()).lives).toBe(rules.lives)
    })

    it('passe par le rattrapage sur le Pool Échecs de l étage quand il est assez fourni', async () => {
      for (let index = 0; index < rules.poolSizeForRecovery; index++) {
        const missed = await createQuestion(db, { floor: 1 })
        await markSeen(db, player.id, missed, { floor: 1 })
        await db.insert(missedPool).values({ userId: player.id, questionId: missed, floor: 1, lastFailedAt: NOW })
      }
      await lose()

      expect((await readGameState(db, await reload(), new Date(clock + rules.cooldownMs + 1))).phase).toBe('recovery')
    })
  })

  describe('victoire', () => {
    it('se lit sur l arène, puis « Continuer » franchit le palier sur une tentative neuve', async () => {
      await pendingVitality()
      await set({ lives: 1 })

      const won = await winTrials(rules.bossHp, await enter())

      expect(won).toMatchObject({ phase: 'bossFight' })
      expect(won.boss).toMatchObject({ hp: 0, outcome: 'victory', trial: null })

      const climbed = await next()

      expect(climbed).toMatchObject({ phase: 'ascent', floor: 2, lives: rules.lives + 1 })
      expect(climbed.question?.statement).toBe('Question de l étage 2 ?')
      expect(climbed.boss).toBeNull()
      expect(await reload()).toMatchObject({ bossHp: null, bossAttemptNumber: 0 })
      // La « tentative suivante » de l'effet, c'est celle-ci.
      expect((await db.select().from(activeEffects))[0]?.anchoredAt).not.toBeNull()
    })

    it('finit la partie au dernier étage', async () => {
      await set({ currentFloor: FLOOR_COUNT })
      await markSeen(db, player.id, await createQuestion(db, { floor: FLOOR_COUNT }), { floor: FLOOR_COUNT })

      const won = await winTrials(rules.bossHp, await enter())

      expect(won.phase).toBe('gameOver')
      expect((await next()).phase).toBe('gameOver')
    })
  })

  // Les gestes de l'admin sur un joueur test : ils ne laissent pas de combat derrière eux.
  describe('joueur test', () => {
    beforeEach(async () => {
      await set({ isTest: true })
      await enter()
    })

    it('envoyé en attente en plein combat, il est vaincu', async () => {
      await sendToCooldown(db, await reload(), tick())

      expect((await readGameState(db, await reload(), tick())).phase).toBe('cooldown')
      expect((await reload()).bossHp).toBeNull()
    })

    it('reculé sous son palier, il n a plus de boss devant lui', async () => {
      await rewindTestPlayer(db, await reload(), 1)

      expect(await reload()).toMatchObject({ bossHp: null })
      expect(await db.select().from(bossTrials)).toHaveLength(0)
    })
  })

  it('attend l attente et le rattrapage avant le combat quand l étage finit sans vie', async () => {
    await set({ lives: 0, cooldownUntil: new Date(NOW.getTime() + 60_000) })

    const state = await readGameState(db, await reload(), NOW)

    expect(state.phase).toBe('cooldown')
    expect((await next()).phase).toBe('cooldown')
  })
})
