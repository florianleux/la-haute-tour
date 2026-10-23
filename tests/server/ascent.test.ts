import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { missedPool, reservations, seenQuestions, users } from '../../server/db/schema'
import { readGameState, serveNextQuestion, submitAnswer } from '../../server/utils/game'
import { rulesForFloor } from '../../server/utils/rules'
import { createPlayer, createQuestion, createTestDatabase, loadPlayer, markSeen } from '../helpers/db'
import type { Database } from '../../server/db/client'
import type { User } from '../../server/db/schema'

const NOW = new Date('2026-09-03T12:00:00.000Z')
const rules = rulesForFloor(1)

describe('boucle d ascension', () => {
  let db: Database
  let player: User

  beforeEach(async () => {
    db = await createTestDatabase()
    const id = await createPlayer(db)
    player = await loadPlayer(db, id)
  })

  const reload = (): Promise<User> => loadPlayer(db, player.id)

  describe('lecture', () => {
    it('ne réserve rien : sans action du joueur, aucune question n est servie', async () => {
      await createQuestion(db)

      const state = await readGameState(db, player, NOW)

      expect(state).toMatchObject({ phase: 'ascent', floor: 1, lives: 3 })
      expect(state.question).toBeNull()
      expect(await db.select().from(reservations)).toHaveLength(0)
    })

    it('rend la même question avec la même échéance à chaque relecture', async () => {
      await createQuestion(db)
      const served = await serveNextQuestion(db, player, NOW)

      const later = await readGameState(db, await reload(), new Date(NOW.getTime() + 5_000))

      expect(later.question).toEqual(served.question)
      expect(await db.select().from(reservations)).toHaveLength(1)
    })
  })

  describe('réservation', () => {
    it('tire une question non vue de l étage courant et l horodate', async () => {
      const questionId = await createQuestion(db, { statement: 'Capitale du Portugal ?' })

      const state = await serveNextQuestion(db, player, NOW)

      expect(state.question).toMatchObject({
        id: questionId,
        statement: 'Capitale du Portugal ?',
        expiresAt: new Date(NOW.getTime() + rules.ascentTimerMs).toISOString(),
      })
    })

    it('suit l ordre du deck et ne revient jamais en arrière', async () => {
      const first = await createQuestion(db)
      const second = await createQuestion(db, { statement: 'Autre' })

      const opened = await serveNextQuestion(db, player, NOW)
      await submitAnswer(db, await reload(), 'Bordeaux', NOW)
      const next = await serveNextQuestion(db, await reload(), NOW)

      expect(opened.question?.id).toBe(first)
      expect(next.question?.id).toBe(second)
    })

    it('ignore une demande alors qu une réservation vit déjà', async () => {
      await createQuestion(db)
      await createQuestion(db, { statement: 'Autre' })
      const first = await serveNextQuestion(db, player, NOW)

      const again = await serveNextQuestion(db, await reload(), new Date(NOW.getTime() + 5_000))

      expect(again.question).toEqual(first.question)
      expect(await db.select().from(reservations)).toHaveLength(1)
    })
  })

  describe('réponse', () => {
    beforeEach(async () => {
      await createQuestion(db, { answerLabel: 'BORDEAUX (Gironde)', accepted: ['Bordeaux'] })
      await serveNextQuestion(db, player, NOW)
      player = await reload()
    })

    it('accepte une bonne réponse, avec tolérance aux fautes', async () => {
      const state = await submitAnswer(db, player, 'bordaux', new Date(NOW.getTime() + 3_000))

      expect(state.verdict).toMatchObject({
        correct: true,
        answerLabel: 'BORDEAUX (Gironde)',
        submittedAnswer: 'bordaux',
        lifeLost: false,
      })
      expect(state.lives).toBe(3)
      expect(await db.select().from(missedPool)).toHaveLength(0)
    })

    it('coûte une vie sur une mauvaise réponse et verse la question au Pool Échecs', async () => {
      const at = new Date(NOW.getTime() + 3_000)

      const state = await submitAnswer(db, player, 'Toulouse', at)

      expect(state.verdict).toMatchObject({
        correct: false,
        answerLabel: 'BORDEAUX (Gironde)',
        submittedAnswer: 'Toulouse',
        lifeLost: true,
      })
      expect(state.lives).toBe(2)
      expect(await db.select().from(missedPool)).toMatchObject([
        { userId: player.id, floor: 1, poolSuccesses: 0, lastFailedAt: at },
      ])
    })

    it('rend la Série : un de plus sur une bonne réponse, zéro sur une faute', async () => {
      await db.update(users).set({ streak: 2 }).where(eq(users.id, player.id))
      const at = new Date(NOW.getTime() + 3_000)

      const right = await submitAnswer(db, await reload(), 'Bordeaux', at)
      expect(right.streak).toBe(3)

      await createQuestion(db, { statement: 'Autre', accepted: ['Lyon'] })
      await serveNextQuestion(db, await reload(), at)
      const wrong = await submitAnswer(db, await reload(), 'Toulouse', at)
      expect(wrong.streak).toBe(0)
    })

    it('compte la question comme vue, juste ou fausse', async () => {
      await submitAnswer(db, player, 'Toulouse', new Date(NOW.getTime() + 3_000))

      expect(await db.select().from(seenQuestions)).toMatchObject([
        { userId: player.id, floor: 1, correct: false },
      ])
    })

    it('traite en timeout une bonne réponse arrivée après l échéance', async () => {
      const late = new Date(NOW.getTime() + rules.ascentTimerMs + rules.latencyGraceMs + 1)

      const state = await submitAnswer(db, player, 'Bordeaux', late)

      expect(state.verdict).toMatchObject({ correct: false, lifeLost: true })
      expect(state.lives).toBe(2)
    })

    it('accepte une réponse partie à temps mais arrivée dans la marge de latence', async () => {
      const barelyLate = new Date(NOW.getTime() + rules.ascentTimerMs + rules.latencyGraceMs)

      const state = await submitAnswer(db, player, 'Bordeaux', barelyLate)

      expect(state.verdict).toMatchObject({ correct: true, lifeLost: false })
      expect(state.lives).toBe(3)
    })

    it('résout en échec une réservation expirée, même sans réponse', async () => {
      const late = new Date(NOW.getTime() + rules.ascentTimerMs + rules.latencyGraceMs + 1)

      const state = await readGameState(db, player, late)

      expect(state.verdict).toMatchObject({ correct: false, submittedAnswer: '', lifeLost: true })
      expect((await reload()).lives).toBe(2)
    })

    it('ne ferme pas une question dont la réponse peut encore être en vol', async () => {
      const withinGrace = new Date(NOW.getTime() + rules.ascentTimerMs + rules.latencyGraceMs)

      const state = await readGameState(db, player, withinGrace)

      expect(state.verdict).toBeNull()
      expect(state.question).not.toBeNull()
      expect((await reload()).lives).toBe(3)
    })

    it('garde le verdict au rechargement, tant que le joueur n a pas continué', async () => {
      await submitAnswer(db, player, 'Toulouse', new Date(NOW.getTime() + 3_000))

      const state = await readGameState(db, await reload(), new Date(NOW.getTime() + 60_000))

      expect(state.verdict).toMatchObject({ correct: false, answerLabel: 'BORDEAUX (Gironde)' })
      expect(state.question).toBeNull()
    })

    it('ignore une réponse sur une réservation déjà résolue et rend l état courant', async () => {
      const first = await submitAnswer(db, player, 'Toulouse', new Date(NOW.getTime() + 3_000))

      const again = await submitAnswer(db, await reload(), 'Bordeaux', new Date(NOW.getTime() + 4_000))

      // Tout est identique sauf ce que la requête vient d écrire : la seconde
      // n écrit rien, donc n annonce rien. C est ce qui empêche un succès d être
      // annoncé deux fois. Voir specs/succes.md#affichage.
      expect(again).toEqual({ ...first, unlocked: [] })
      expect((await reload()).lives).toBe(2)
    })

    it('ignore une réponse sans réservation du tout', async () => {
      const fresh = await createPlayer(db, { discordId: '987', username: 'frodo' })
      const other = await loadPlayer(db, fresh)

      const state = await submitAnswer(db, other, 'Bordeaux', NOW)

      expect(state.verdict).toBeNull()
      expect(state.lives).toBe(3)
    })
  })

  describe('suite', () => {
    it('résout le verdict et sert une question encore non vue', async () => {
      await createQuestion(db)
      await createQuestion(db, { statement: 'Autre' })
      const served = await serveNextQuestion(db, player, NOW)
      await submitAnswer(db, await reload(), 'Bordeaux', new Date(NOW.getTime() + 1_000))

      const state = await serveNextQuestion(db, await reload(), new Date(NOW.getTime() + 2_000))

      expect(state.verdict).toBeNull()
      expect(state.question?.id).not.toBe(served.question?.id)
      expect(state.question?.expiresAt).toBe(
        new Date(NOW.getTime() + 2_000 + rules.ascentTimerMs).toISOString(),
      )
    })
  })

  describe('fin de vies et fin d étage', () => {
    it('bascule en attente à la perte de la dernière vie', async () => {
      await createQuestion(db)
      // Une deuxième question à l'étage : sans elle, l'étage serait fini et le
      // palier passerait devant l'attente.
      await createQuestion(db, { statement: 'Autre' })
      await db.update(users).set({ lives: 1 }).where(eq(users.id, player.id))
      await serveNextQuestion(db, await reload(), NOW)

      const state = await submitAnswer(db, await reload(), 'Toulouse', new Date(NOW.getTime() + 1_000))

      expect(state.phase).toBe('cooldown')
      expect(state.cooldownUntil).toBe(
        new Date(NOW.getTime() + 1_000 + rules.cooldownMs).toISOString(),
      )
      // La question qui a coûté la dernière vie est justement celle dont le joueur
      // n'a pas encore lu la réponse.
      expect(state.verdict).toMatchObject({ correct: false, lifeLost: true })
      expect(state.question).toBeNull()
    })

    it('atteint le palier quand toutes les questions de l étage sont vues', async () => {
      const questionId = await createQuestion(db)
      await markSeen(db, player.id, questionId, { floor: 1 })
      // Le palier mène quelque part : sans question au-dessus, c'est la fin du deck.
      await createQuestion(db, { floor: 2 })

      const state = await readGameState(db, player, NOW)

      expect(state.phase).toBe('floorEnd')
    })

    it('atteint la fin de partie au dernier étage', async () => {
      await db.update(users).set({ currentFloor: 6 }).where(eq(users.id, player.id))
      const questionId = await createQuestion(db, { floor: 6 })
      await markSeen(db, player.id, questionId, { floor: 6 })

      const state = await readGameState(db, await reload(), NOW)

      expect(state.phase).toBe('gameOver')
    })
  })

  // Un double envoi — double clic, deux onglets, une console : les deux requêtes
  // lisent la question encore en main avant que l'une n'écrive. Une seule doit
  // compter. Voir server/utils/game.ts#resolve.
  describe('réponses parties ensemble', () => {
    beforeEach(async () => {
      // Deux questions : une seule vue ne doit pas finir l'étage.
      await createQuestion(db)
      await createQuestion(db, { statement: 'Autre' })
      await serveNextQuestion(db, player, NOW)
    })

    it('ne compte la question vue qu une fois', async () => {
      const holding = await reload()

      await Promise.all([
        submitAnswer(db, holding, 'Bordeaux', NOW),
        submitAnswer(db, holding, 'Bordeaux', NOW),
      ])

      expect(await reload()).toMatchObject({ floorSeen: 1, attemptSeen: 1, seenTotal: 1, streak: 1 })
      expect((await readGameState(db, await reload(), NOW)).phase).toBe('ascent')
    })

    it('garde le verdict de la première et le rend aux deux', async () => {
      const holding = await reload()

      const [first, second] = await Promise.all([
        submitAnswer(db, holding, 'Toulouse', NOW),
        submitAnswer(db, holding, 'Bordeaux', NOW),
      ])

      expect(first.verdict).toMatchObject({ correct: false, submittedAnswer: 'Toulouse', lifeLost: true })
      expect(second.verdict).toEqual(first.verdict)
      expect(second.lives).toBe(rules.lives - 1)
      expect(await reload()).toMatchObject({ lives: rules.lives - 1, floorSeen: 1, streak: 0 })
      expect(await db.select().from(missedPool)).toHaveLength(1)
      // La bonne réponse n'a pas compté : rien ne se grave sur elle.
      expect((await reload()).achievementsHeld).not.toContain('FIRST_CORRECT')
    })

    it('ne ferme pas la question suivante avec une réponse en retard', async () => {
      // La réponse en retard lit la première réservation, puis attend : l'autre
      // onglet répond et sert la suivante avant qu'elle n'écrive.
      let release!: () => void
      const held = new Promise<void>(resolve => { release = resolve })
      let paused = false
      const late: Database = Object.assign(Object.create(db), {
        batch: async (queries: Parameters<Database['batch']>[0]) => {
          const result = await db.batch(queries)
          if (!paused) {
            paused = true
            await held
          }
          return result
        },
      })

      const pending = submitAnswer(late, await reload(), 'Toulouse', NOW)
      await submitAnswer(db, await reload(), 'Bordeaux', NOW)
      const next = await serveNextQuestion(db, await reload(), NOW)
      release()
      await pending

      const [open] = await db.select().from(reservations)
      expect(open).toMatchObject({ questionId: next.question?.id, resolvedAt: null })
      expect(await reload()).toMatchObject({ lives: rules.lives, seenTotal: 1 })
      expect(await db.select().from(missedPool)).toHaveLength(0)
    })
  })
})
