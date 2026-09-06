import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { inventory, missedPool, recoveryQuestions } from '../../server/db/schema'
import { readGameState, serveNextQuestion, submitAnswer } from '../../server/utils/game'
import { castSpell } from '../../server/utils/effects'
import { rulesForFloor } from '../../server/utils/rules'
import { createPlayer, createQuestion, createTestDatabase, loadPlayer, markSeen } from '../helpers/db'
import { installNitroGlobals } from '../helpers/nitro'
import type { Database } from '../../server/db/client'
import type { User } from '../../server/db/schema'

installNitroGlobals()

const NOW = new Date('2026-09-06T12:00:00.000Z')
const rules = rulesForFloor(1)

/** L'attente vient de s'ouvrir ; elle s'achèvera juste après. */
const WAIT_OVER = new Date(NOW.getTime() + rules.cooldownMs + 1_000)

describe('Indulgence, sur le rattrapage que l attente ouvre', () => {
  let db: Database
  let player: User

  beforeEach(async () => {
    db = await createTestDatabase()
    const id = await createPlayer(db, {
      lives: 0,
      cooldownUntil: new Date(NOW.getTime() + rules.cooldownMs),
    })
    player = await loadPlayer(db, id)
    // Une question encore à voir : sans elle l'étage serait fini, et le palier
    // primerait sur l'attente.
    await createQuestion(db, { statement: 'Encore à voir ?', accepted: ['oui'] })
  })

  const reload = (): Promise<User> => loadPlayer(db, player.id)

  async function castIndulgence(): Promise<void> {
    await db.insert(inventory).values({ userId: player.id, spell: 'INDULGENCE', obtainedAt: NOW })
    await castSpell(db, await reload(), 'INDULGENCE', 'self', NOW)
  }

  /** Remplit le Pool Échecs de l'étage courant. */
  async function fillPool(size: number): Promise<void> {
    for (let i = 0; i < size; i++) {
      const questionId = await createQuestion(db, { statement: `Ratée ${i} ?`, accepted: [`r${i}`] })
      await markSeen(db, player.id, questionId, { floor: 1, correct: false })
      await db.insert(missedPool).values({ userId: player.id, questionId, floor: 1, lastFailedAt: NOW })
    }
  }

  /** Les questions que le rattrapage vient de tirer. */
  async function drawn(): Promise<string[]> {
    const rows = await db
      .select()
      .from(recoveryQuestions)
      .where(eq(recoveryQuestions.userId, player.id))

    return rows.map(row => row.questionId)
  }

  /** L'attente s'achève et le joueur lance son rattrapage. */
  async function startRecovery(): Promise<void> {
    await serveNextQuestion(db, await reload(), WAIT_OVER)
  }

  it('tire le nombre ordinaire quand rien n est posé', async () => {
    await fillPool(rules.recoveryQuestions * 3)

    await startRecovery()

    expect(await drawn()).toHaveLength(rules.recoveryQuestions)
  })

  // « Le rattrapage en cours compte » : lancée pendant l'attente, Indulgence
  // s'applique au rattrapage que cette attente ouvre, pas au suivant.
  // Voir specs/bonus.md#ancrage-et-durée-de-vie.
  it('double le tirage du rattrapage que l attente en cours ouvre', async () => {
    await fillPool(rules.recoveryQuestions * 3)
    await castIndulgence()

    await startRecovery()

    expect(await drawn()).toHaveLength(rules.recoveryQuestions * rules.indulgenceFactor)
  })

  it('ne tire jamais plus que ce que le Pool Échecs contient', async () => {
    const pool = rules.recoveryQuestions + 1
    await fillPool(pool)
    await castIndulgence()

    await startRecovery()

    expect(await drawn()).toHaveLength(pool)
  })

  it('tire des questions distinctes', async () => {
    await fillPool(rules.recoveryQuestions * 3)
    await castIndulgence()

    await startRecovery()

    const questions = await drawn()
    expect(new Set(questions).size).toBe(questions.length)
  })

  // Le piège : doubler le tirage ne doit pas relever la barre d'entrée, sinon
  // le sort empêcherait le rattrapage qu'il est censé rallonger.
  it('ouvre le rattrapage sur un pool qui atteint tout juste le seuil', async () => {
    await fillPool(rules.poolSizeForRecovery)
    await castIndulgence()

    await startRecovery()

    expect(await drawn()).toHaveLength(rules.poolSizeForRecovery)
    expect((await readGameState(db, await reload(), WAIT_OVER)).phase).toBe('recovery')
  })

  it('laisse le seuil de bonnes réponses là où il est', async () => {
    await fillPool(rules.recoveryQuestions * 3)
    await castIndulgence()
    await startRecovery()

    const state = await readGameState(db, await reload(), WAIT_OVER)
    expect(state.recovery).toMatchObject({
      total: rules.recoveryQuestions * rules.indulgenceFactor,
      resumes: false,
    })
  })

  // Ponctuel : le rattrapage qu'il a modifié le consomme. Un rattrapage
  // entièrement manqué ouvre une nouvelle attente, et l'Indulgence d'avant ne
  // doit pas rallonger celui que cette nouvelle attente ouvrira.
  it('est consommé par le rattrapage qu il a rallongé', async () => {
    await fillPool(rules.recoveryQuestions * 3)
    await castIndulgence()
    await startRecovery()

    // Toutes les questions jouées, toutes fausses : une nouvelle attente s'ouvre.
    for (let i = 0; i < rules.recoveryQuestions * rules.indulgenceFactor; i++) {
      await submitAnswer(db, await reload(), 'faux', WAIT_OVER)
      await serveNextQuestion(db, await reload(), WAIT_OVER)
    }

    const afterFailure = await reload()
    expect(afterFailure.cooldownUntil).not.toBeNull()

    const nextWaitOver = new Date(afterFailure.cooldownUntil!.getTime() + 1_000)
    await db.delete(recoveryQuestions).where(eq(recoveryQuestions.userId, player.id))
    await serveNextQuestion(db, await reload(), nextWaitOver)

    expect(await drawn()).toHaveLength(rules.recoveryQuestions)
  })

  it('reste lisible sur l écran d attente', async () => {
    await fillPool(rules.recoveryQuestions * 3)
    await castIndulgence()

    const state = await readGameState(db, await reload(), NOW)
    expect(state.effects).toMatchObject([{ spell: 'INDULGENCE', face: 'boon', state: 'pending' }])
  })

  // Le joueur compte ses questions : un rattrapage plus long qu'à l'ordinaire
  // doit se dire, sinon il passe pour un bug.
  it('se dit rallongé au joueur qui le joue', async () => {
    await fillPool(rules.recoveryQuestions * 3)
    await castIndulgence()
    await startRecovery()

    expect((await readGameState(db, await reload(), WAIT_OVER)).recovery)
      .toMatchObject({ lengthened: true })
  })

  it('ne se dit pas rallongé quand rien ne l a rallongé', async () => {
    await fillPool(rules.recoveryQuestions * 3)
    await startRecovery()

    expect((await readGameState(db, await reload(), WAIT_OVER)).recovery)
      .toMatchObject({ lengthened: false })
  })
})
