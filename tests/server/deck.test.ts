import { beforeEach, describe, expect, it } from 'vitest'
import { addQuestion, removeQuestion } from '../../server/utils/questions'
import { floorSize } from '../../server/utils/deck'
import { readGameState, serveNextQuestion, submitAnswer } from '../../server/utils/game'
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

  it('dit ce que l étage contient', async () => {
    await createQuestion(db, { statement: 'Ailleurs ?', floor: 2 })

    expect(await floorSize(db, 1)).toBe(4)
    expect(await floorSize(db, 2)).toBe(1)
  })

  it('rend zéro pour un étage que le deck ne porte pas', async () => {
    expect(await floorSize(db, 5)).toBe(0)
  })

  // Le nombre est lu, jamais compté : c'est tout l'intérêt. Le compter
  // parcourait l'index de l'étage entier, à chaque lecture d'état.
  it('se lit en une requête, quel que soit le deck', async () => {
    const queries = countQueries(db)

    await floorSize(db, 1)

    expect(queries()).toBe(1)
  })

  it('grandit quand une question entre au deck', async () => {
    await addQuestion(db, {
      statement: 'Une de plus ?',
      answerLabel: 'OUI',
      floor: 1,
      acceptedAnswers: ['oui'],
    })

    // Sans ce suivi, l'étage garderait sa taille d'avant et le palier tomberait
    // une question trop tôt.
    expect(await floorSize(db, 1)).toBe(5)
  })

  it('rétrécit quand une question sort du deck', async () => {
    const id = await createQuestion(db, { statement: 'À supprimer ?' })
    expect(await floorSize(db, 1)).toBe(5)

    await removeQuestion(db, id)

    expect(await floorSize(db, 1)).toBe(4)
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
    // Le palier mène quelque part : sans question au-dessus, c'est la fin du deck.
    await createQuestion(db, { floor: 2 })

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

    // Lu plutôt que cliqué : le clic suivant franchirait le palier.
    const end = await readGameState(db, await loadPlayer(db, player.id), NOW)
    expect(end).toMatchObject({ phase: 'floorEnd', floor: 1 })
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
