import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { achievements, missedPool, pocketSpells, settings, users } from '../../server/db/schema'
import { STREAK_TIERS, VIEW_MILESTONES } from '../../shared/utils/achievements'
import { FLOOR_COUNT } from '../../shared/utils/floors'
import { unlock } from '../../server/utils/achievements'
import { openPlayerChest, readGameState, serveNextQuestion, submitAnswer } from '../../server/utils/game'
import { rulesForFloor } from '../../server/utils/rules'
import { createPlayer, createQuestion, createTestDatabase, loadPlayer, markSeen } from '../helpers/db'
import { rolls } from '../helpers/random'
import type { AchievementId } from '../../shared/utils/achievements'
import type { Database } from '../../server/db/client'
import type { User } from '../../server/db/schema'

const NOW = new Date('2026-09-03T12:00:00.000Z')
const rules = rulesForFloor(1)
const [FIRST_TIER] = STREAK_TIERS

describe('les succès en jeu', () => {
  let db: Database
  let player: User

  beforeEach(async () => {
    db = await createTestDatabase()
    const id = await createPlayer(db)
    player = await loadPlayer(db, id)
  })

  const reload = (): Promise<User> => loadPlayer(db, player.id)

  async function held(): Promise<AchievementId[]> {
    const rows = await db
      .select({ achievement: achievements.achievement })
      .from(achievements)
      .where(eq(achievements.userId, player.id))

    return rows.map(row => row.achievement)
  }

  /** Une question de plus dans le deck, servie puis répondue. */
  async function answer(text: string, at: Date = NOW): Promise<AchievementId[]> {
    await createQuestion(db, { statement: 'Préfecture de la Gironde ?', accepted: ['Bordeaux'] })
    await serveNextQuestion(db, await reload(), at)

    return (await submitAnswer(db, await reload(), text, at)).unlocked
  }

  describe('sur une réponse', () => {
    it('annonce la première bonne réponse, et ne la rejoue jamais', async () => {
      expect(await answer('Bordeaux')).toContain('FIRST_CORRECT')
      expect(await answer('Bordeaux')).not.toContain('FIRST_CORRECT')
      expect(await held()).toContain('FIRST_CORRECT')
    })

    it('annonce la première mauvaise réponse', async () => {
      expect(await answer('Toulouse')).toContain('FIRST_WRONG')
    })

    it('compte la réponse vide', async () => {
      expect(await answer('')).toContain('EMPTY_ANSWER')
    })

    // Une lecture d'état qui trouve une réservation échue la résout : elle écrit
    // donc pour de bon, et ce qu'elle écrit s'annonce là ou nulle part.
    it('annonce ce qu un délai écoulé débloque, à la lecture qui le constate', async () => {
      await createQuestion(db, { statement: 'Préfecture de la Gironde ?', accepted: ['Bordeaux'] })
      await serveNextQuestion(db, player, NOW)

      const late = new Date(NOW.getTime() + rules.ascentTimerMs + rules.latencyGraceMs + 1)
      const state = await readGameState(db, await reload(), late)

      expect(state.unlocked).toContain('EMPTY_ANSWER')
      expect((await readGameState(db, await reload(), late)).unlocked).toEqual([])
    })

    it('annonce la première mort quand la dernière vie tombe', async () => {
      await db.update(users).set({ lives: 1 }).where(eq(users.id, player.id))

      expect(await answer('Toulouse')).toContain('FIRST_DEATH')
    })

    it('donne le palier de série atteint, et lui seul', async () => {
      await db.update(users).set({ streak: FIRST_TIER - 1 }).where(eq(users.id, player.id))

      const unlocked = await answer('Bordeaux')

      expect(unlocked).toContain(`STREAK_${FIRST_TIER}`)
      expect(unlocked).not.toContain(`STREAK_${STREAK_TIERS[1]}`)
    })

    it('casse la série sur une erreur, et la reprend à un', async () => {
      await db.update(users).set({ streak: 40 }).where(eq(users.id, player.id))

      await answer('Toulouse')
      expect((await reload()).streak).toBe(0)

      await answer('Bordeaux')
      expect((await reload()).streak).toBe(1)
    })

    it('compte les positions notables sur les vues de toujours', async () => {
      const [milestone] = VIEW_MILESTONES
      await db.update(users).set({ seenTotal: milestone - 1 }).where(eq(users.id, player.id))

      expect(await answer('Bordeaux')).toContain(`QUESTION_${milestone}`)
    })

    it('estampille le jour joué, une fois et pas deux', async () => {
      await answer('Bordeaux')
      expect(await reload()).toMatchObject({ daysPlayed: 1, playStreak: 1 })

      await answer('Bordeaux', new Date(NOW.getTime() + 60_000))
      expect(await reload()).toMatchObject({ daysPlayed: 1, playStreak: 1 })
    })

    // Le silence de l'Assiduité est une règle d'affichage, pas d'écriture : le
    // serveur grave et annonce ces succès comme les autres. Voir
    // tests/app/achievement-toasts.test.ts, qui couvre le silence côté client.
    it('grave l Assiduité comme n importe quel autre succès', async () => {
      await db.update(users).set({
        daysPlayed: 6,
        playStreak: 1,
        lastPlayedDay: '2026-09-02',
      }).where(eq(users.id, player.id))

      expect(await answer('Bordeaux')).toContain('DAYS_7')
      expect(await held()).toContain('DAYS_7')
      expect(await held()).toContain('TWO_DAYS_IN_A_ROW')
    })
  })

  /**
   * Un étage d une seule question, dont le joueur tient la dernière : répondre
   * l achève. C est cette réponse-là qui gagne le sans-faute, pas le clic qui
   * franchit ensuite le palier.
   */
  async function holdingLastQuestionOf(floor: number): Promise<void> {
    await db.update(users).set({ currentFloor: floor }).where(eq(users.id, player.id))
    await createQuestion(db, {
      floor,
      statement: `La dernière de l étage ${floor} ?`,
      accepted: ['Bordeaux'],
    })
    await serveNextQuestion(db, await reload(), NOW)
  }

  describe('quand un étage s achève', () => {
    it('donne le sans-faute à la réponse qui termine l étage', async () => {
      await holdingLastQuestionOf(1)

      const state = await submitAnswer(db, await reload(), 'Bordeaux', NOW)

      expect(state.unlocked).toContain('FLAWLESS_FLOOR_1')
    })

    // La série est remise à zéro par toute vie perdue et par toute tentative
    // neuve : rester sous la taille de l étage, c est avoir été coupé.
    it('refuse le sans-faute à qui a été coupé en route', async () => {
      await holdingLastQuestionOf(1)

      const state = await submitAnswer(db, await reload(), 'Toulouse', NOW)

      expect(state.unlocked).not.toContain('FLAWLESS_FLOOR_1')
    })

    /**
     * La tour finie, la phase gameOver ne porte plus aucune action : personne ne
     * reclique, donc rien ne se gagnerait plus tard. Si ces deux succès ne
     * tombaient pas ici, ils seraient inatteignables.
     */
    it('donne la fin du jeu et le sans-faute du dernier étage, sans clic de plus', async () => {
      await holdingLastQuestionOf(FLOOR_COUNT)

      const state = await submitAnswer(db, await reload(), 'Bordeaux', NOW)

      // Le boss du dernier étage reste à battre : la tour, au sens des succès,
      // est finie quand toutes ses questions sont vues. Voir ADR 0007.
      expect(state.phase).toBe('floorEnd')
      expect(state.unlocked).toContain('GAME_COMPLETED')
      expect(state.unlocked).toContain(`FLAWLESS_FLOOR_${FLOOR_COUNT}`)
    })
  })

  // Atteindre l'étage suivant se gagne sur la réponse qui finit l'étage, pas
  // à la victoire sur le boss : il n'est qu'une porte de plus. Voir ADR 0007.
  describe('au palier', () => {
    /** Un étage 2 où monter : sans lui, c'est la fin du deck. */
    const floorAbove = (): Promise<string> => createQuestion(db, { floor: 2, statement: 'Question de l étage 2 ?' })

    it('annonce l étage atteint sur la réponse qui finit l étage', async () => {
      await floorAbove()
      await holdingLastQuestionOf(1)

      const state = await submitAnswer(db, await reload(), 'Toulouse', NOW)

      expect(state.phase).toBe('floorEnd')
      expect(state.unlocked).toContain('REACHED_FLOOR_2')
    })

    it('ne l annonce pas en fin de deck : il n y a pas d étage où monter', async () => {
      await holdingLastQuestionOf(1)

      const state = await submitAnswer(db, await reload(), 'Bordeaux', NOW)

      expect(state.phase).toBe('deckEnd')
      expect(state.unlocked).not.toContain('REACHED_FLOOR_2')
      expect(state.unlocked).not.toContain('FIRST_ASCENT')
    })

    it('donne le premier arrivé en haut, à un seul joueur', async () => {
      await floorAbove()
      await holdingLastQuestionOf(1)
      expect((await submitAnswer(db, await reload(), 'Bordeaux', NOW)).unlocked).toContain('FIRST_ASCENT')

      // Le second finit le même étage, sur la même et unique question.
      const second = await createPlayer(db, { discordId: 'second', username: 'frodo' })
      await serveNextQuestion(db, await loadPlayer(db, second), NOW)

      const other = await submitAnswer(db, await loadPlayer(db, second), 'Bordeaux', NOW)
      expect(other.phase).toBe('floorEnd')
      expect(other.unlocked).not.toContain('FIRST_ASCENT')
    })

    // Il arbitre les parties, il n a pas à y peser — sans quoi le succès serait
    // pris au premier test qui suit l ouverture. Voir specs/succes.md.
    it('ne donne le premier arrivé ni à l admin ni à un joueur test', async () => {
      await db.update(users).set({ isAdmin: true }).where(eq(users.id, player.id))
      await floorAbove()
      await holdingLastQuestionOf(1)

      const state = await submitAnswer(db, await reload(), 'Bordeaux', NOW)

      expect(state.unlocked).not.toContain('FIRST_ASCENT')
      expect(await db.select().from(settings)).toEqual([])
    })
  })

  describe('au rattrapage', () => {
    /** Un joueur sans vie, attente échue, avec de quoi tirer un rattrapage. */
    async function readyToRecover(): Promise<string[]> {
      const ids: string[] = []

      for (let i = 0; i < rules.poolSizeForRecovery; i++) {
        const questionId = await createQuestion(db, {
          statement: `Ratée ${i} ?`,
          accepted: ['Bordeaux'],
        })
        await markSeen(db, player.id, questionId, { correct: false })
        await db.insert(missedPool).values({
          userId: player.id,
          questionId,
          floor: 1,
          poolSuccesses: rules.poolSuccessesToLeave - 1,
          lastFailedAt: NOW,
        })
        ids.push(questionId)
      }

      // Une question encore à voir : sans elle l étage est épuisé, et le palier
      // prime sur les vies — il n y aurait aucun rattrapage à ouvrir.
      await createQuestion(db, { statement: 'Encore à voir ?', accepted: ['Bordeaux'] })

      await db
        .update(users)
        .set({ lives: 0, cooldownUntil: new Date(NOW.getTime() - 1) })
        .where(eq(users.id, player.id))

      player = await reload()

      return ids
    }

    it('annonce le premier rattrapage à l ouverture du tirage', async () => {
      await readyToRecover()

      const state = await serveNextQuestion(db, player, NOW)

      expect(state.unlocked).toContain('FIRST_RECOVERY')
    })

    it('annonce la sortie du Pool Échecs', async () => {
      await readyToRecover()
      await serveNextQuestion(db, player, NOW)

      const state = await submitAnswer(db, await reload(), 'Bordeaux', NOW)

      expect(state.unlocked).toContain('POOL_CLEARED')
    })

    // Une journée passée entièrement à rattraper est une journée jouée : le
    // rattrapage ne fait avancer aucune progression, mais on y répond bien à des
    // questions. Voir specs/succes.md#assiduité.
    it('compte le jour même si la journée n a servi qu à rattraper', async () => {
      await readyToRecover()
      await serveNextQuestion(db, player, NOW)

      await submitAnswer(db, await reload(), 'Bordeaux', NOW)

      expect(await reload()).toMatchObject({ daysPlayed: 1, playStreak: 1 })
    })
  })

  /**
   * Le joueur porte son palmarès pour que le retranchement ne coûte pas une
   * lecture de la table à chaque requête. Voir server/db/schema.ts.
   */
  describe('le palmarès porté', () => {
    it('suit ce que la table reçoit', async () => {
      await answer('Bordeaux')

      // Comparés comme des ensembles : l'union se fait en base, qui rend ses
      // valeurs triées, là où la table les rend dans l'ordre d'obtention.
      expect([...(await reload()).achievementsHeld].sort()).toEqual([...await held()].sort())
    })

    // Deux écritures d'une même requête — un rattrapage qui s'ouvre puis se
    // scelle — partent du même joueur, lu une fois.
    it('n efface pas ce qu une écriture précédente vient d y ajouter', async () => {
      const stale = await reload()

      await unlock(db, stale, ['FIRST_CORRECT'], NOW)
      await unlock(db, stale, ['FIRST_WRONG'], NOW)

      const carried = (await reload()).achievementsHeld
      expect(carried).toHaveLength(2)
      expect(carried).toContain('FIRST_CORRECT')
      expect(carried).toContain('FIRST_WRONG')
    })

    it('n annonce pas deux fois un succès qu il aurait oublié, et se recale', async () => {
      await answer('Bordeaux')
      await db.update(users).set({ achievementsHeld: [] }).where(eq(users.id, player.id))

      expect(await answer('Bordeaux')).not.toContain('FIRST_CORRECT')
      expect((await reload()).achievementsHeld).toContain('FIRST_CORRECT')
      expect((await held()).filter(id => id === 'FIRST_CORRECT')).toHaveLength(1)
    })
  })

  describe('au coffre', () => {
    it('compte le Mimic comme une mort, et lui casse la série', async () => {
      // Un sort déjà sorti d'un coffre, toujours en poche : le Mimic peut attaquer.
      await db.update(users).set({ streak: 12, lastChest: 'spell' }).where(eq(users.id, player.id))
      await db.insert(pocketSpells).values({ userId: player.id, spell: 'RESPITE', obtainedAt: NOW })

      // Une de plus que le seuil : la dernière question restante de l étage ne
      // porte jamais de coffre, un Mimic y opposerait le palier à l attente.
      for (let i = 0; i <= rules.questionsPerChest; i++) {
        await createQuestion(db, { statement: `Question ${i} ?`, accepted: ['Bordeaux'] })
      }

      await db
        .update(users)
        .set({ floorSeen: rules.questionsPerChest - 1, attemptSeen: rules.questionsPerChest - 1 })
        .where(eq(users.id, player.id))

      await serveNextQuestion(db, await reload(), NOW)
      await submitAnswer(db, await reload(), 'Bordeaux', NOW)

      const state = await openPlayerChest(db, await reload(), NOW, rolls(0))

      expect(state.unlocked).toContain('FIRST_DEATH')
      expect((await reload()).streak).toBe(0)
    })
  })
})
