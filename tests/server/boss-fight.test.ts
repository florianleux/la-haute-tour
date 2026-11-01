import { eq, isNotNull } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { activeEffects, attempts, bossKeys, bossTrials, items, missedPool, recoveryQuestions, reservations, users } from '../../server/db/schema'
import { FLOOR_COUNT } from '../../shared/utils/floors'
import { climbToDoor, descendToCamp, enterBoss, openDoor, placeKey, readGameState, serveNextQuestion, submitAnswer } from '../../server/utils/game'
import { placeKeyIfRoom } from '../../server/utils/bossKeys'
import { requireCamp } from '../../server/utils/camp'
import { rulesForFloor } from '../../server/utils/rules'
import { rewindTestPlayer, sendToCooldown } from '../../server/utils/testPlayers'
import { seedFlags } from '../../scripts/seed-flags'
import { createPlayer, createQuestion, createTestDatabase, loadPlayer, markSeen } from '../helpers/db'
import { installNitroGlobals } from '../helpers/nitro'
import type { Database } from '../../server/db/client'
import type { GameState } from '../../server/utils/game'
import type { User } from '../../server/db/schema'

// La garde du camp refuse avec createError, comme un handler.
installNitroGlobals()

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
  const bag = async (): Promise<string[]> =>
    (await db.select({ item: items.item }).from(items).where(eq(items.userId, player.id))).map(row => row.item)
  const tick = (): Date => new Date(clock += 1_000)
  const next = async (): Promise<GameState> => serveNextQuestion(db, await reload(), tick())
  /** « Entrer », au terme de la porte et de l'introduction. */
  const enter = async (): Promise<GameState> => enterBoss(db, await reload(), tick())
  const answer = async (text: string): Promise<GameState> => submitAnswer(db, await reload(), text, tick())
  /** « Ouvrir », devant la porte déverrouillée. */
  const open = async (): Promise<GameState> => openDoor(db, await reload(), tick())
  /** « Redescendre », devant la porte verrouillée. */
  const descend = async (): Promise<GameState> => descendToCamp(db, await reload(), tick())
  /** « Remonter », du camp vers la porte déverrouillée. */
  const climb = async (): Promise<GameState> => climbToDoor(db, await reload(), tick())

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
    expect(verdict).toMatchObject({ phase: 'floorEnd', door: null })
    expect(verdict.verdict?.questionId).toBe(last)

    const door = await next()

    expect(door).toMatchObject({ phase: 'bossDoor', verdict: null, boss: null })
    expect(await db.select().from(reservations)).toHaveLength(0)
    // Un « Suivant » en retard ne lance pas le combat sous la porte : seul
    // « Entrer » l'ouvre.
    expect((await next()).phase).toBe('bossDoor')
    expect((await enter()).phase).toBe('bossFight')
  })

  it("n ouvre le combat qu au palier, et qu une fois", async () => {
    await enter()
    const before = await db.select().from(bossTrials)

    expect((await enter()).phase).toBe('bossFight')
    expect(await db.select().from(bossTrials)).toEqual(before)
    expect((await reload()).bossAttemptNumber).toBe(1)
  })

  // specs/boss.md#arriver-devant-la-porte
  describe('porte', () => {
    it('attend le joueur sans équipe déverrouillée, fermée, sans poseur', async () => {
      const state = await readGameState(db, await reload(), tick())

      expect(state).toMatchObject({ phase: 'bossDoor', door: { unlocked: true, opened: false, hasKey: false, keyHolders: [], spot: 'door', bossAttemptNumber: 0 } })
    })

    // specs/boss.md#introduction-et-animations
    it('compte les combats déjà ouverts : un retry ne rejoue pas l introduction entière', async () => {
      await set({ bossAttemptNumber: 1 })

      expect((await readGameState(db, await reload(), tick())).door).toMatchObject({ bossAttemptNumber: 1 })
    })

    it('retient « Ouvrir » : au retour, la porte est déjà ouverte', async () => {
      expect((await open()).door).toMatchObject({ opened: true })
      expect((await readGameState(db, await reload(), tick())).door).toMatchObject({ opened: true })
    })

    it('reste verrouillée pour le joueur en équipe : ni « Ouvrir », ni « Entrer »', async () => {
      await set({ team: 'TLM' })

      expect((await open()).door).toEqual({ unlocked: false, opened: false, hasKey: false, keyHolders: [], spot: 'door', bossAttemptNumber: 0 })
      expect((await enter()).phase).toBe('bossDoor')
      expect(await db.select().from(bossTrials)).toHaveLength(0)
    })

    it('sert la clé de l étage à poser, pas celle d un autre étage', async () => {
      await set({ team: 'TLM' })
      await db.insert(bossKeys).values({ userId: player.id, floor: 2, obtainedAt: NOW })
      expect((await readGameState(db, await reload(), tick())).door).toMatchObject({ hasKey: false })

      await db.insert(bossKeys).values({ userId: player.id, floor: 1, obtainedAt: NOW })
      expect((await readGameState(db, await reload(), tick())).door).toMatchObject({ unlocked: false, hasKey: true })
    })

    it('ne sert plus la clé une fois posée', async () => {
      await set({ team: 'TLM' })
      await db.insert(bossKeys).values({ userId: player.id, floor: 1, obtainedAt: NOW, placedAt: NOW })

      expect((await readGameState(db, await reload(), tick())).door).toMatchObject({ hasKey: false })
    })

    // specs/boss.md#poser-la-clé
    describe('poser sa clé', () => {
      const place = async (): Promise<GameState> => placeKey(db, await reload(), tick())

      /** Un coéquipier devant la même porte, sa clé déjà posée ou non. */
      async function teammate(username: string, { placed = true, team = 'TLM' as User['team'], isTest = false, floor = 1 } = {}): Promise<User> {
        const [mate] = await db.insert(users).values({ discordId: username, username, team, isTest, currentFloor: 1 }).returning()
        await db.insert(bossKeys).values({ userId: mate!.id, floor, obtainedAt: NOW, placedAt: placed ? NOW : null })
        return mate!
      }

      beforeEach(async () => {
        await set({ team: 'TLM' })
        await db.insert(bossKeys).values({ userId: player.id, floor: 1, obtainedAt: NOW })
      })

      it('pose la première clé : une serrure allumée, la porte reste verrouillée', async () => {
        const state = await place()

        expect(state.door).toEqual({ unlocked: false, opened: false, hasKey: false, keyHolders: ['gandalf'], spot: 'door', bossAttemptNumber: 0 })
      })

      it('pose la deuxième clé : la porte se déverrouille, « Ouvrir » tout de suite', async () => {
        await teammate('frodon')

        expect((await place()).door).toEqual({ unlocked: true, opened: false, hasKey: false, keyHolders: ['frodon', 'gandalf'], spot: 'door', bossAttemptNumber: 0 })
        expect((await open()).door).toMatchObject({ opened: true })
      })

      it('déverrouille la porte pour le coéquipier qui arrive sans clé', async () => {
        await db.delete(bossKeys)
        await teammate('frodon')
        await teammate('sam')

        expect((await readGameState(db, await reload(), tick())).door).toEqual({ unlocked: true, opened: false, hasKey: false, keyHolders: ['frodon', 'sam'], spot: 'door', bossAttemptNumber: 0 })
      })

      it('laisse sa clé stockée, sans effet, devant une porte déjà déverrouillée', async () => {
        await teammate('frodon')
        await teammate('sam')

        expect((await place()).door).toMatchObject({ unlocked: true, hasKey: true, keyHolders: ['frodon', 'sam'] })
        expect((await db.select().from(bossKeys).where(eq(bossKeys.userId, player.id)))[0]!.placedAt).toBeNull()
      })

      it('ne compte que les clés de son équipe, de son étage, de son monde', async () => {
        await teammate('saroumane', { team: 'MIDI' })
        await teammate('frodon', { floor: 2 })
        await teammate('testeur', { isTest: true })
        await teammate('boromir', { placed: false })

        expect((await readGameState(db, await reload(), tick())).door).toMatchObject({ unlocked: false, keyHolders: [] })
      })

      it('ne pose rien sans clé, ni hors de la porte', async () => {
        await db.delete(bossKeys)
        await db.insert(bossKeys).values({ userId: player.id, floor: 2, obtainedAt: NOW })
        expect((await place()).door).toMatchObject({ keyHolders: [] })

        await db.delete(bossKeys)
        await db.insert(bossKeys).values({ userId: player.id, floor: 1, obtainedAt: NOW })
        await set({ team: null })
        await enter()
        await set({ team: 'TLM' })
        await place()
        expect((await db.select().from(bossKeys))[0]!.placedAt).toBeNull()
      })

      // Deux requêtes simultanées lisent la même porte, puis écrivent toutes deux :
      // la garde est dans l'écriture, c'est elle qu'on éprouve, état périmé compris.
      it('ne pose pas deux fois la même clé, même sur un état périmé', async () => {
        await placeKeyIfRoom(db, await reload(), NOW)
        await placeKeyIfRoom(db, await reload(), tick())

        expect(await db.select().from(bossKeys)).toEqual([expect.objectContaining({ placedAt: NOW })])
      })

      it('ne pose pas de troisième clé, même sur un état périmé', async () => {
        await teammate('frodon')
        await teammate('sam')

        await placeKeyIfRoom(db, await reload(), NOW)

        expect(await db.select().from(bossKeys).where(isNotNull(bossKeys.placedAt))).toHaveLength(2)
      })
    })

    // specs/boss.md#attendre-au-camp
    describe('redescendre au camp', () => {
      it('attend devant la porte tant que le joueur n a pas redescendu', async () => {
        await set({ team: 'TLM' })

        expect((await readGameState(db, await reload(), tick())).door).toMatchObject({ spot: 'door' })
      })

      it('retient le camp : au retour, le joueur y est encore', async () => {
        await set({ team: 'TLM' })

        expect(await descend()).toMatchObject({ phase: 'bossDoor', door: { spot: 'camp' } })
        expect((await readGameState(db, await reload(), tick())).door).toMatchObject({ spot: 'camp' })
      })

      // Les boîtes du camp s'y ouvrent comme à l'attente ; devant la porte, non.
      it('ouvre le camp au joueur redescendu, pas à celui qui reste devant la porte', async () => {
        await set({ team: 'TLM' })
        await expect(requireCamp(db, await reload(), tick())).rejects.toMatchObject({ statusCode: 403 })

        await descend()

        await expect(requireCamp(db, await reload(), tick())).resolves.toBeUndefined()
      })

      it('ne quitte pas une porte déverrouillée', async () => {
        expect((await descend()).door).toMatchObject({ unlocked: true, spot: 'door' })
        expect((await reload()).doorSpot).toBe('door')
      })

      it('n a pas de sens au combat', async () => {
        await enter()

        expect((await descend()).phase).toBe('bossFight')
        expect((await reload()).doorSpot).toBe('door')
      })
    })

    // specs/boss.md#attendre-au-camp
    describe('remonter à la porte', () => {
      it('ramène devant la porte déverrouillée, et le retient', async () => {
        // Sans équipe, la porte est déverrouillée : le joueur est au camp d'avant.
        await set({ doorSpot: 'camp' })

        expect(await climb()).toMatchObject({ phase: 'bossDoor', door: { unlocked: true, spot: 'door' } })
        expect((await readGameState(db, await reload(), tick())).door).toMatchObject({ spot: 'door' })
      })

      it('retrouve la porte déjà ouverte : « Entrer » attend', async () => {
        await open()
        await set({ doorSpot: 'camp' })

        expect((await climb()).door).toMatchObject({ opened: true, spot: 'door' })
      })

      it('refuse la porte verrouillée : le joueur reste au camp', async () => {
        await set({ team: 'TLM' })
        await descend()

        expect((await climb()).door).toMatchObject({ unlocked: false, spot: 'camp' })
        expect((await reload()).doorSpot).toBe('camp')
      })

      it('n a pas de sens au combat', async () => {
        await enter()
        await set({ doorSpot: 'camp' })

        expect((await climb()).phase).toBe('bossFight')
        expect((await reload()).doorSpot).toBe('camp')
      })
    })

    it('n existe pas au combat, et ne s y ouvre pas', async () => {
      expect((await enter()).door).toBeNull()
      // Ouvrir en plein combat n'écrit rien.
      await open()
      expect((await reload()).doorOpened).toBe(false)
    })
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

      // Sans rattrapage à annoncer : il n'y en a pas au boss.
      expect(state).toMatchObject({ phase: 'cooldown', lives: 0, recovery: null, nextRecovery: null })
      expect(state.cooldownUntil).not.toBeNull()
      expect(state.boss).toMatchObject({ outcome: 'defeat', hp: rules.bossHp, trial: null })
      expect((await reload()).bossHp).toBeNull()
      // Vaincu, le joueur ne repart pas avec la relique.
      expect(state.boss?.relic).toBeNull()
      expect(await bag()).toEqual([])
    })

    it('laisse au camp au bout de l attente : « Remonter » face à la porte ouverte, puis le combat suivant à vies pleines', async () => {
      await open()
      await lose()
      const afterCooldown = new Date(clock + rules.cooldownMs + 1)

      const camp = await readGameState(db, await reload(), afterCooldown)
      expect(camp).toMatchObject({ phase: 'bossDoor', lives: rules.lives })
      expect(camp.door).toMatchObject({ spot: 'camp', unlocked: true, opened: true })

      clock = afterCooldown.getTime()
      // Ouverte avant le premier combat, elle le reste : « Entrer » direct.
      expect((await climb()).door).toMatchObject({ spot: 'door', opened: true })
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
      expect(passed.boss).toMatchObject({ outcome: 'passed', hp: rules.bossHp, trial: null, relic: 'JULIEN_CARD' })
      // Passé comme battu, le boss laisse sa relique. Voir specs/boss.md#récompense.
      expect(await bag()).toEqual(['JULIEN_CARD'])

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

    it('ne passe pas par le rattrapage, même sur un Pool Échecs assez fourni', async () => {
      for (let index = 0; index < rules.poolSizeForRecovery; index++) {
        const missed = await createQuestion(db, { floor: 1 })
        await markSeen(db, player.id, missed, { floor: 1 })
        await db.insert(missedPool).values({ userId: player.id, questionId: missed, floor: 1, lastFailedAt: NOW })
      }
      await lose()
      clock += rules.cooldownMs

      // « Commencer » au bout de l'attente, avant toute lecture.
      const resumed = await next()

      expect(resumed).toMatchObject({ phase: 'bossDoor', lives: rules.lives, recovery: null })
      expect(resumed.door?.spot).toBe('camp')
      expect((await readGameState(db, await reload(), tick())).phase).toBe('bossDoor')
    })

    it('efface un rattrapage tiré au boss avant que la règle ne change, et rend les vies', async () => {
      const missed = await createQuestion(db, { floor: 1 })
      await markSeen(db, player.id, missed, { floor: 1 })
      await db.insert(missedPool).values({ userId: player.id, questionId: missed, floor: 1, lastFailedAt: NOW })
      await lose()
      clock += rules.cooldownMs
      await db.insert(recoveryQuestions).values({ userId: player.id, questionId: missed, position: 0, correct: null })

      const resumed = await next()

      expect(resumed).toMatchObject({ phase: 'bossDoor', lives: rules.lives })
      expect(await db.select().from(recoveryQuestions)).toHaveLength(0)
    })
  })

  describe('victoire', () => {
    it('se lit sur l arène, puis « Continuer » franchit le palier sur une tentative neuve', async () => {
      await pendingVitality()
      await set({ lives: 1 })
      await open()
      // Remonté du camp avant d'entrer : le palier franchi l'efface.
      await set({ doorSpot: 'camp' })

      const won = await winTrials(rules.bossHp, await enter())

      expect(won).toMatchObject({ phase: 'bossFight' })
      expect(won.boss).toMatchObject({ hp: 0, outcome: 'victory', trial: null, relic: 'JULIEN_CARD' })
      // Sa relique rejoint le sac au verdict qui l'abat. Voir specs/boss.md#récompense.
      expect(await bag()).toEqual(['JULIEN_CARD'])

      const climbed = await next()

      expect(climbed).toMatchObject({ phase: 'ascent', floor: 2, lives: rules.lives + 1 })
      expect(climbed.question?.statement).toBe('Question de l étage 2 ?')
      expect(climbed.boss).toBeNull()
      expect(await reload()).toMatchObject({ bossHp: null, bossAttemptNumber: 0, doorOpened: false, doorSpot: 'door' })
      // La « tentative suivante » de l'effet, c'est celle-ci.
      expect((await db.select().from(activeEffects))[0]?.anchoredAt).not.toBeNull()
    })

    it('ne laisse sa relique qu une fois, même si le dernier verdict part deux fois', async () => {
      const state = await winTrials(rules.bossHp - 1, await enter())
      const user = await reload()

      await Promise.all([submitAnswer(db, user, answerOf(state), tick()), submitAnswer(db, user, answerOf(state), tick())])

      expect(await bag()).toEqual(['JULIEN_CARD'])
    })

    it('ne laisse pas une relique déjà acquise : un joueur test reculé rebat le même boss', async () => {
      await db.insert(items).values({ userId: player.id, item: 'JULIEN_CARD', obtainedAt: NOW })

      await winTrials(rules.bossHp, await enter())

      expect(await bag()).toEqual(['JULIEN_CARD'])
    })

    it('ne laisse rien en cours de combat', async () => {
      const state = await winTrials(rules.bossHp - 1, await enter())

      expect(state.boss?.relic).toBeNull()
      expect(await bag()).toEqual([])
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

    it('reculé sous son palier, il retrouve un boss neuf : ni combat compté, ni porte ouverte', async () => {
      await set({ doorOpened: true, doorSpot: 'camp' })
      await rewindTestPlayer(db, await reload(), 1)

      expect(await reload()).toMatchObject({ bossHp: null, bossAttemptNumber: 0, doorOpened: false, doorSpot: 'door' })
      expect(await db.select().from(bossTrials)).toHaveLength(0)
    })
  })

  // specs/boss.md#cas-à-0-vie
  it('mène droit à la porte quand la dernière vie tombe sur la dernière question, puis au combat à vies pleines', async () => {
    await createQuestion(db, { floor: 1 })
    await set({ floorCursor: 1, lives: 1 })
    await serveNextQuestion(db, await reload(), NOW)

    const verdict = await answer('Atlantide')

    // Pas une chute : ni rattrapage annoncé, ni leçon de Michel.
    expect(verdict).toMatchObject({ phase: 'floorEnd', lives: 0, cooldownUntil: null, nextRecovery: null })
    expect(verdict.unlocked).not.toContain('FIRST_DEATH')
    expect(await next()).toMatchObject({ phase: 'bossDoor', door: { spot: 'door', unlocked: true } })
    expect(await enter()).toMatchObject({ phase: 'bossFight', lives: rules.lives })
  })
})
