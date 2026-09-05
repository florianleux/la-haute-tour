import { beforeEach, describe, expect, it } from 'vitest'
import { addQuestion, removeQuestion } from '../../server/utils/questions'
import { floorSize } from '../../server/utils/deck'
import { serveNextQuestion, submitAnswer } from '../../server/utils/game'
import { createPlayer, createQuestion, createTestDatabase, loadPlayer } from '../helpers/db'
import type { Database } from '../../server/db/client'
import type { User } from '../../server/db/schema'

const NOW = new Date('2026-09-03T12:00:00.000Z')

/** Compte les requêtes réellement parties à la base. */
function countQueries(db: Database): () => number {
  let count = 0
  const original = db.select.bind(db)

  Object.assign(db, {
    select: (...args: unknown[]) => {
      count++
      // @ts-expect-error instrumentation de test : la signature varie
      return original(...args)
    },
  })

  return () => {
    const seen = count
    count = 0
    return seen
  }
}

describe('taille d un étage', () => {
  let db: Database

  beforeEach(async () => {
    db = await createTestDatabase()
    for (let i = 0; i < 4; i++) {
      await createQuestion(db, { statement: `Question ${i} ?` })
    }
  })

  it('compte les questions de l étage', async () => {
    await createQuestion(db, { statement: 'Ailleurs ?', floor: 2 })

    expect(await floorSize(db, 1, NOW)).toBe(4)
    expect(await floorSize(db, 2, NOW)).toBe(1)
  })

  it('ne redemande pas à la base ce qu elle vient de lui dire', async () => {
    await floorSize(db, 1, NOW)
    const queries = countQueries(db)

    await floorSize(db, 1, NOW)
    await floorSize(db, 1, new Date(NOW.getTime() + 1_000))

    expect(queries()).toBe(0)
  })

  it('relit une fois la mémoire périmée', async () => {
    await floorSize(db, 1, NOW)
    const queries = countQueries(db)

    await floorSize(db, 1, new Date(NOW.getTime() + 60_000))

    expect(queries()).toBe(1)
  })

  it('oublie ce qu elle savait quand une question entre au deck', async () => {
    expect(await floorSize(db, 1, NOW)).toBe(4)

    await addQuestion(db, {
      statement: 'Une de plus ?',
      answerLabel: 'OUI',
      floor: 1,
      acceptedAnswers: ['oui'],
    })

    // Sans invalidation, l'étage garderait sa taille d'avant et le palier
    // tomberait une question trop tôt.
    expect(await floorSize(db, 1, NOW)).toBe(5)
  })

  it('oublie ce qu elle savait quand une question sort du deck', async () => {
    const id = await createQuestion(db, { statement: 'À supprimer ?' })
    expect(await floorSize(db, 1, NOW)).toBe(5)

    await removeQuestion(db, id)

    expect(await floorSize(db, 1, NOW)).toBe(4)
  })
})

describe('tirage d une question', () => {
  let db: Database
  let player: User

  beforeEach(async () => {
    db = await createTestDatabase()
    player = await loadPlayer(db, await createPlayer(db, { lives: 99 }))
  })

  it('sert chaque question de l étage une fois, et une seule, avant le palier', async () => {
    const wanted = 12
    for (let i = 0; i < wanted; i++) {
      await createQuestion(db, { statement: `Question ${i} ?` })
    }

    const served: string[] = []
    for (let i = 0; i < wanted; i++) {
      const state = await serveNextQuestion(db, await loadPlayer(db, player.id), NOW)
      expect(state.question).not.toBeNull()
      served.push(state.question!.id)
      await submitAnswer(db, await loadPlayer(db, player.id), 'Bordeaux', NOW)
    }

    // Le curseur avance de rang en rang : il doit couvrir l'étage entier, sans
    // doublon ni trou, et s'arrêter pile au palier.
    expect(new Set(served).size).toBe(wanted)

    const end = await serveNextQuestion(db, await loadPlayer(db, player.id), NOW)
    expect(end.phase).toBe('floorEnd')
  })

  it('sert la même séquence à tous les joueurs', async () => {
    for (let i = 0; i < 5; i++) {
      await createQuestion(db, { statement: `Question ${i} ?` })
    }

    const sequences: string[][] = []
    for (let joueur = 0; joueur < 3; joueur++) {
      const id = await createPlayer(db, { discordId: `joueur-${joueur}`, lives: 99 })
      const served: string[] = []

      for (let i = 0; i < 5; i++) {
        const state = await serveNextQuestion(db, await loadPlayer(db, id), NOW)
        served.push(state.question!.id)
        await submitAnswer(db, await loadPlayer(db, id), 'Bordeaux', NOW)
      }

      sequences.push(served)
    }

    // Le deck a un ordre, le même pour tous : ce qui diffère d'un joueur à
    // l'autre est où il en est, pas ce qu'il voit.
    expect(sequences[1]).toEqual(sequences[0])
    expect(sequences[2]).toEqual(sequences[0])
  })
})
