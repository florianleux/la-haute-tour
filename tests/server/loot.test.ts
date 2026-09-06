import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { missedPool, users } from '../../server/db/schema'
import { readGameState, serveNextQuestion } from '../../server/utils/game'
import { rulesForFloor } from '../../server/utils/rules'
import { createPlayer, createQuestion, createTestDatabase, loadPlayer, markSeen } from '../helpers/db'
import type { Database } from '../../server/db/client'
import type { User } from '../../server/db/schema'

const NOW = new Date('2026-09-03T12:00:00.000Z')
const rules = rulesForFloor(1)
const STEP = rules.questionsPerChest

describe('question loot', () => {
  let db: Database
  let player: User

  beforeEach(async () => {
    db = await createTestDatabase()
    const id = await createPlayer(db)
    player = await loadPlayer(db, id)
  })

  /**
   * Un étage de `total` questions dont `seen` sont déjà vues : la prochaine
   * servie porte donc la position `seen + 1`.
   */
  async function floorWith(total: number, seen: number): Promise<string[]> {
    const ids: string[] = []
    for (let i = 0; i < total; i++) {
      ids.push(await createQuestion(db, { statement: `Question ${i + 1} ?` }))
    }

    const already = ids.slice(0, seen)

    if (already.length) {
      await markSeen(db, player.id, already, { floor: 1, seenAt: NOW, submittedAnswer: 'Bordeaux' })
    }

    return already
  }

  it('marque la question qui tombe sur le seuil', async () => {
    await floorWith(STEP * 3, STEP - 1)

    const state = await serveNextQuestion(db, await loadPlayer(db, player.id), NOW)

    expect(state.question).toMatchObject({ lootQuestion: true })
  })

  it('ne marque pas celle d avant', async () => {
    await floorWith(STEP * 3, STEP - 2)

    const state = await serveNextQuestion(db, await loadPlayer(db, player.id), NOW)

    expect(state.question).toMatchObject({ lootQuestion: false })
  })

  it('épargne la dernière question restante de l étage', async () => {
    // L'étage s'arrête pile sur un multiple du seuil : le coffre est perdu, et
    // c'est assumé — sinon un Mimic y opposerait le palier à l'attente.
    await floorWith(STEP, STEP - 1)

    const state = await serveNextQuestion(db, await loadPlayer(db, player.id), NOW)

    expect(state.question).toMatchObject({ lootQuestion: false })
  })

  it('garde le même statut d une relecture à l autre', async () => {
    await floorWith(STEP * 3, STEP - 1)
    const served = await serveNextQuestion(db, await loadPlayer(db, player.id), NOW)

    const later = await readGameState(db, await loadPlayer(db, player.id), new Date(NOW.getTime() + 5_000))

    expect(later.question).toEqual(served.question)
    expect(later.question).toMatchObject({ lootQuestion: true })
  })

  it('ne marque jamais une question de rattrapage, même au rang du seuil', async () => {
    // Le rang du joueur tombe pile sur le seuil, mais ses questions de
    // rattrapage sont déjà vues : elles ne comptent dans aucun rang.
    const missed = await floorWith(STEP * 3, STEP - 1)

    await db.insert(missedPool).values(missed.map(questionId => ({
      userId: player.id,
      questionId,
      floor: 1,
      lastFailedAt: NOW,
    })))
    await db
      .update(users)
      .set({ lives: 0, cooldownUntil: new Date(NOW.getTime() - 1) })
      .where(eq(users.id, player.id))

    const state = await serveNextQuestion(db, await loadPlayer(db, player.id), NOW)

    expect(state).toMatchObject({ phase: 'recovery' })
    expect(state.question).toMatchObject({ lootQuestion: false })
  })

  it('ne change rien à la progression ni aux vies', async () => {
    await floorWith(STEP * 3, STEP - 1)

    const state = await serveNextQuestion(db, await loadPlayer(db, player.id), NOW)

    expect(state).toMatchObject({ phase: 'ascent', lives: rules.lives, floorSeen: STEP - 1 })
  })
})
