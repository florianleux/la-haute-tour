import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { users } from '../../server/db/schema'
import { readGameState, serveNextQuestion, submitAnswer } from '../../server/utils/game'
import { createPlayer, createQuestion, createTestDatabase } from '../helpers/db'
import type { Database } from '../../server/db/client'
import type { User } from '../../server/db/schema'

/**
 * La base est distante en production : chaque requête est un aller-retour réseau,
 * mesuré à ~135 ms. Ces budgets empêchent un N+1 de revenir s'installer sur les
 * chemins que le joueur emprunte à chaque question.
 *
 * On compte les appels au query builder ; un sous-select en compte un de plus que
 * d'allers-retours réels, d'où le budget de 5 sur un chemin qui en fait 4.
 */
function countQueries(db: Database): () => number {
  let count = 0

  for (const method of ['select', 'insert', 'update', 'delete'] as const) {
    const original = db[method].bind(db)
    Object.assign(db, {
      [method]: (...args: unknown[]) => {
        count++
        // @ts-expect-error instrumentation de test : la signature varie par méthode
        return original(...args)
      },
    })
  }

  return () => {
    const seen = count
    count = 0
    return seen
  }
}

const NOW = new Date('2026-09-03T12:00:00.000Z')

describe('budget de requêtes des chemins chauds', () => {
  let db: Database
  let player: User
  let queries: () => number

  beforeEach(async () => {
    db = await createTestDatabase()
    const id = await createPlayer(db)
    for (let i = 0; i < 5; i++) {
      await createQuestion(db, { statement: `Question ${i} ?`, accepted: ['Bordeaux'] })
    }
    player = (await db.select().from(users).where(eq(users.id, id)))[0]
    queries = countQueries(db)
  })

  it('lit l état de jeu en deux requêtes', async () => {
    await serveNextQuestion(db, player, NOW)
    queries()

    await readGameState(db, player, NOW)

    expect(queries()).toBeLessThanOrEqual(2)
  })

  it('sert la question suivante sans relire ce qu elle vient d écrire', async () => {
    await serveNextQuestion(db, player, NOW)
    await submitAnswer(db, player, 'Bordeaux', NOW)
    queries()

    await serveNextQuestion(db, player, NOW)

    expect(queries()).toBeLessThanOrEqual(5)
  })

  it('résout une réponse sans relire l état', async () => {
    await serveNextQuestion(db, player, NOW)
    queries()

    await submitAnswer(db, player, 'Toulouse', NOW)

    expect(queries()).toBeLessThanOrEqual(7)
  })
})
