import { beforeEach, describe, expect, it } from 'vitest'
import { readGameState, serveNextQuestion, submitAnswer } from '../../server/utils/game'
import { createPlayer, createQuestion, createTestDatabase, loadPlayer } from '../helpers/db'
import type { Database } from '../../server/db/client'
import type { User } from '../../server/db/schema'

/**
 * La base est distante en production : chaque aller-retour réseau est mesuré à
 * ~135 ms. Ces budgets empêchent un N+1 de revenir s'installer sur les chemins
 * que le joueur emprunte à chaque question.
 *
 * On compte les allers-retours, pas les requêtes : un lot en fait un seul, quel
 * que soit le nombre de requêtes qu'il transporte, et c'est ce qui se paie.
 */
function countQueries(db: Database): () => number {
  let count = 0
  // Le client libSQL sous Drizzle : c'est lui qui part sur le réseau, une fois
  // par `execute` et une fois par `batch`, quel que soit le contenu du lot.
  const client = (db as unknown as { $client: Record<'execute' | 'batch', (...args: unknown[]) => unknown> }).$client

  for (const method of ['execute', 'batch'] as const) {
    const original = client[method].bind(client)
    Object.assign(client, {
      [method]: (...args: unknown[]) => {
        count++
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
    player = await loadPlayer(db, id)
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
