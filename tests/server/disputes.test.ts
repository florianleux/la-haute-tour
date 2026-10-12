import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  acceptedAnswers,
  disputes,
  missedPool,
  recoveryQuestions,
  seenQuestions,
  users,
} from '../../server/db/schema'
import {
  disputableErrors,
  openDispute,
  pendingDisputes,
  settleDispute,
} from '../../server/utils/disputes'
import { readGameState, serveNextQuestion, submitAnswer } from '../../server/utils/game'
import { rulesForFloor } from '../../server/utils/rules'
import { createPlayer, createQuestion, createTestDatabase, loadPlayer } from '../helpers/db'
import { installNitroGlobals } from '../helpers/nitro'
import type { Database } from '../../server/db/client'
import type { User } from '../../server/db/schema'

// Les utils de contestation refusent avec createError, comme un handler.
installNitroGlobals()

const NOW = new Date('2026-09-03T12:00:00.000Z')
const rules = rulesForFloor(1)

describe('contestation', () => {
  let db: Database
  let player: User

  beforeEach(async () => {
    db = await createTestDatabase()
    const id = await createPlayer(db)
    player = await loadPlayer(db, id)
  })

  const reload = (): Promise<User> => loadPlayer(db, player.id)

  /** Joue une question d'ascension et répond ce qu'on lui dit. */
  async function play(answer: string, at: Date = NOW): Promise<string> {
    const served = await serveNextQuestion(db, await reload(), at)
    await submitAnswer(db, await reload(), answer, new Date(at.getTime() + 1_000))

    return served.question?.id ?? ''
  }

  describe('ce qui est contestable', () => {
    beforeEach(async () => {
      // Les deux questions acceptent la même réponse : le tirage est au hasard,
      // le test ne doit pas l'être.
      await createQuestion(db, { statement: 'Capitale de la Gironde ?', accepted: ['Bordeaux'] })
      await createQuestion(db, { statement: 'Autre ?', accepted: ['Bordeaux'] })
    })

    it('rend les erreurs de la tentative, avec ce que le joueur avait répondu', async () => {
      const questionId = await play('Toulouse')

      const errors = await disputableErrors(db, await reload())

      expect(errors).toMatchObject([{ questionId, submittedAnswer: 'Toulouse' }])
    })

    it('ne rend jamais une bonne réponse', async () => {
      await play('Bordeaux')

      expect(await disputableErrors(db, await reload())).toEqual([])
    })

    it('ne rend jamais une réponse vide : l accepter validerait le vide pour tous', async () => {
      await play('')

      expect(await disputableErrors(db, await reload())).toEqual([])
    })

    it('ne rend plus une question déjà contestée', async () => {
      const questionId = await play('Toulouse')
      await openDispute(db, await reload(), questionId, NOW)

      expect(await disputableErrors(db, await reload())).toEqual([])
    })

    it('garde les erreurs des tentatives précédentes tant qu elles sont au pool', async () => {
      const questionId = await play('Toulouse')
      // Une reprise commence une tentative : l'erreur reste au pool et donc
      // contestable — c'est la fusion des écrans qui le veut.
      await db
        .update(users)
        .set({ attemptStartedAt: new Date(NOW.getTime() + 60_000) })
        .where(eq(users.id, player.id))

      expect(await disputableErrors(db, await reload())).toMatchObject([{ questionId }])
    })
  })

  describe('ouverture', () => {
    beforeEach(async () => {
      // Les deux questions acceptent la même réponse : le tirage est au hasard,
      // le test ne doit pas l'être.
      await createQuestion(db, { statement: 'Capitale de la Gironde ?', accepted: ['Bordeaux'] })
      await createQuestion(db, { statement: 'Autre ?', accepted: ['Bordeaux'] })
    })

    it('ouvre une contestation en attente', async () => {
      const questionId = await play('Toulouse')

      await openDispute(db, await reload(), questionId, NOW)

      expect(await db.select().from(disputes)).toMatchObject([
        { userId: player.id, questionId, status: 'pending' },
      ])
    })

    it('refuse une deuxième contestation sur la même question', async () => {
      const questionId = await play('Toulouse')
      await openDispute(db, await reload(), questionId, NOW)

      await expect(openDispute(db, await reload(), questionId, NOW)).rejects.toThrow()
      expect(await db.select().from(disputes)).toHaveLength(1)
    })

    it('refuse une réponse vide', async () => {
      const questionId = await play('')

      await expect(openDispute(db, await reload(), questionId, NOW)).rejects.toThrow()
      expect(await db.select().from(disputes)).toHaveLength(0)
    })
  })

  describe('file admin', () => {
    it('montre la réponse du joueur face aux réponses acceptées', async () => {
      await createQuestion(db, {
        statement: 'Capitale de la Gironde ?',
        answerLabel: 'BORDEAUX',
        accepted: ['Bordeaux', 'bordeaux (33)'],
      })
      const questionId = await play('Toulouse')
      await openDispute(db, await reload(), questionId, NOW)

      expect(await pendingDisputes(db)).toMatchObject([{
        questionId,
        username: 'gandalf',
        statement: 'Capitale de la Gironde ?',
        submittedAnswer: 'Toulouse',
        acceptedAnswers: ['Bordeaux', 'bordeaux (33)'],
      }])
    })

    it('ne montre que les contestations en attente', async () => {
      await createQuestion(db, { accepted: ['Bordeaux'] })
      const questionId = await play('Toulouse')
      await openDispute(db, await reload(), questionId, NOW)
      const [dispute] = await db.select().from(disputes)

      await settleDispute(db, dispute.id, 'rejected', NOW)

      expect(await pendingDisputes(db)).toEqual([])
    })
  })

  describe('arbitrage', () => {
    let questionId: string

    beforeEach(async () => {
      await createQuestion(db, {
        statement: 'Capitale de la Gironde ?',
        answerLabel: 'BORDEAUX',
        accepted: ['Bordeaux'],
      })
      await createQuestion(db, { statement: 'Autre ?', accepted: ['Bordeaux'] })
      questionId = await play('Bordo-sur-Garonne')
      await openDispute(db, await reload(), questionId, NOW)
    })

    async function settle(verdict: 'accepted' | 'rejected', at: Date = NOW): Promise<void> {
      const [dispute] = await db.select().from(disputes)
      await settleDispute(db, dispute.id, verdict, at)
    }

    it('accepter ajoute la réponse aux réponses acceptées, pour tous les joueurs', async () => {
      await settle('accepted')

      const accepted = await db
        .select()
        .from(acceptedAnswers)
        .where(eq(acceptedAnswers.questionId, questionId))
      expect(accepted.map(row => row.text)).toContain('Bordo-sur-Garonne')
    })

    it('accepter corrige le verdict du joueur et sort la question du Pool Échecs', async () => {
      await settle('accepted')

      const [seen] = await db
        .select()
        .from(seenQuestions)
        .where(eq(seenQuestions.questionId, questionId))
      expect(seen.correct).toBe(true)
      expect(await db.select().from(missedPool)).toHaveLength(0)

      // Le verdict encore à l'écran suit la correction.
      const state = await readGameState(db, await reload(), NOW)
      expect(state.verdict).toMatchObject({ correct: true })
    })

    it('accepter rend une vie, sans plafond', async () => {
      // Le joueur a déjà retrouvé ses vies pleines : la réparation passe outre.
      await db.update(users).set({ lives: rules.lives }).where(eq(users.id, player.id))

      await settle('accepted')

      expect((await reload()).lives).toBe(rules.lives + 1)
    })

    it('rejeter clôt la contestation sans aucun effet', async () => {
      await settle('rejected')

      const [seen] = await db
        .select()
        .from(seenQuestions)
        .where(eq(seenQuestions.questionId, questionId))
      expect(seen.correct).toBe(false)
      expect((await reload()).lives).toBe(rules.lives - 1)
      expect(await db.select().from(missedPool)).toHaveLength(1)
      expect(await db.select().from(disputes)).toMatchObject([{ status: 'rejected' }])
    })

    it('ne s arbitre pas deux fois', async () => {
      await settle('accepted')

      await expect(settle('accepted')).rejects.toThrow()
      const accepted = await db
        .select()
        .from(acceptedAnswers)
        .where(eq(acceptedAnswers.questionId, questionId))
      expect(accepted.filter(row => row.text === 'Bordo-sur-Garonne')).toHaveLength(1)
    })
  })

  describe('arbitrage pendant l attente', () => {
    beforeEach(async () => {
      for (let i = 0; i < 4; i++) {
        await createQuestion(db, { statement: `Question ${i} ?`, accepted: [`reponse ${i}`] })
      }
    })

    /** Perd les trois vies, la dernière sur une réponse contestée. */
    async function loseEverything(): Promise<string> {
      await play('nawak')
      await play('nawak')

      return play('presque bon')
    }

    it('annule l attente et rend la même tentative avec une vie', async () => {
      const questionId = await loseEverything()
      await openDispute(db, await reload(), questionId, NOW)
      const [dispute] = await db.select().from(disputes)

      await settleDispute(db, dispute.id, 'accepted', NOW)

      const resumed = await reload()
      expect(resumed.lives).toBe(1)
      expect(resumed.cooldownUntil).toBeNull()
      expect(await readGameState(db, resumed, NOW)).toMatchObject({ phase: 'ascent', lives: 1 })
    })

    it('n ouvre aucun rattrapage : l attente n a jamais eu lieu', async () => {
      const questionId = await loseEverything()
      await openDispute(db, await reload(), questionId, NOW)
      const [dispute] = await db.select().from(disputes)

      await settleDispute(db, dispute.id, 'accepted', NOW)

      expect(await db.select().from(recoveryQuestions)).toHaveLength(0)
    })
  })
})
