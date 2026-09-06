import { and, eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { activeEffects, inventory, missedPool, seenQuestions, users } from '../../server/db/schema'
import { readGameState, readMissedPool, serveNextQuestion } from '../../server/utils/game'
import { castSpell } from '../../server/utils/effects'
import { rulesForFloor } from '../../server/utils/rules'
import { createPlayer, createQuestion, createTestDatabase, loadPlayer, markSeen } from '../helpers/db'
import { installNitroGlobals } from '../helpers/nitro'
import type { Database } from '../../server/db/client'
import type { User } from '../../server/db/schema'

installNitroGlobals()

const NOW = new Date('2026-09-06T12:00:00.000Z')
const rules = rulesForFloor(1)
const WAIT_OVER = new Date(NOW.getTime() + rules.cooldownMs + 1_000)

describe('Purge, sur le Pool Échecs', () => {
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

  /** Un exemplaire en poche, puis lancé sur soi pendant l'attente. */
  async function castPurge(caster: number = player.id): Promise<void> {
    await db.insert(inventory).values({ userId: caster, spell: 'PURGE', obtainedAt: NOW })
    await castSpell(db, await loadPlayer(db, caster), 'PURGE', NOW)
  }

  /** Remplit le Pool Échecs de l'étage courant. */
  async function fillPool(size: number): Promise<string[]> {
    const ids: string[] = []
    for (let i = 0; i < size; i++) {
      const questionId = await createQuestion(db, { statement: `Ratée ${i} ?`, accepted: [`r${i}`] })
      await markSeen(db, player.id, questionId, { floor: 1, correct: false })
      await db.insert(missedPool).values({ userId: player.id, questionId, floor: 1, lastFailedAt: NOW })
      ids.push(questionId)
    }
    return ids
  }

  const pool = async (): Promise<string[]> =>
    (await db.select().from(missedPool).where(eq(missedPool.userId, player.id)))
      .map(row => row.questionId)

  it('retire une question du Pool Échecs, tout de suite', async () => {
    await fillPool(4)

    await castPurge()

    expect(await pool()).toHaveLength(3)
  })

  // Elle en sort comme elle en sortirait par le seuil de réussites : le passage
  // reste vu, donc l'étage ne recule pas. Voir specs/mecanique.md#pool-échecs.
  it('laisse la question vue : la progression d étage ne bouge pas', async () => {
    const ids = await fillPool(4)

    await castPurge()

    const remaining = await pool()
    const purged = ids.find(id => !remaining.includes(id))!
    const seen = await db
      .select()
      .from(seenQuestions)
      .where(and(eq(seenQuestions.userId, player.id), eq(seenQuestions.questionId, purged)))

    expect(seen).toHaveLength(1)
    expect((await reload()).floorSeen).toBe(4)
  })

  it('ne touche qu au Pool Échecs de l étage où se tient le joueur', async () => {
    await fillPool(2)
    const elsewhere = await createQuestion(db, { floor: 2, statement: 'Ailleurs ?', accepted: ['la'] })
    await db.insert(missedPool).values({
      userId: player.id,
      questionId: elsewhere,
      floor: 2,
      lastFailedAt: NOW,
    })

    await castPurge()

    expect(await pool()).toContain(elsewhere)
  })

  // Pool vide : le sort part, ne fait rien, et ne lève rien. On ne vérifie pas
  // avant de lancer. Voir specs/bonus.md#catalogue.
  it('est gaspillé sur un Pool Échecs vide, sans erreur', async () => {
    await castPurge()

    expect(await pool()).toHaveLength(0)
    expect(await db.select().from(activeEffects)).toHaveLength(1)
    expect(await db.select().from(inventory).where(eq(inventory.userId, player.id))).toHaveLength(0)
  })

  // Ponctuel et sans interaction : deux lancers sortent deux questions.
  // Voir specs/bonus.md#cumul.
  it('en retire deux quand le joueur lance deux fois', async () => {
    await fillPool(4)

    await castPurge()
    await castPurge()

    expect(await pool()).toHaveLength(2)
  })

  it('s arrête au budget de l attente : le troisième ne retire rien', async () => {
    await fillPool(4)

    await castPurge()
    await castPurge()
    await castPurge()

    expect(await pool()).toHaveLength(2)
  })

  // Ponctuel, sans interaction : chaque lancer sort sa question, et deux
  // n'interagissent pas. Le second lancer suppose une seconde attente tant que
  // le ciblage n'existe pas — deux lanceurs sur la même attente arrivent avec
  // les équipes. Voir specs/bonus.md#cumul.
  it('sort une seconde question au lancer suivant, sans interaction', async () => {
    const ids = await fillPool(4)
    await castPurge()
    const afterFirst = await pool()

    // Une seconde attente : c'est son début qui rouvre le droit de lancer.
    const nextStart = new Date(NOW.getTime() + rules.cooldownMs)
    await db
      .update(users)
      .set({
        cooldownStartedAt: nextStart,
        cooldownUntil: new Date(nextStart.getTime() + rules.cooldownMs),
        cooldownBaseMs: rules.cooldownMs,
      })
      .where(eq(users.id, player.id))

    await castPurge()

    const afterSecond = await pool()
    expect(afterSecond).toHaveLength(2)
    // Deux questions différentes sont parties, jamais deux fois la même.
    expect(new Set([...afterSecond, ...ids]).size).toBe(ids.length)
    expect(afterFirst.filter(id => !afterSecond.includes(id))).toHaveLength(1)
  })

  it('reflète le pool réduit dans ce que l écran d attente lit', async () => {
    await fillPool(4)

    await castPurge()

    const page = await readMissedPool(db, await reload(), { limit: 10, offset: 0, order: 'desc' })
    expect(page.total).toBe(3)
    expect(page.entries).toHaveLength(3)
  })

  // Assumé : vider son pool est un objectif de jeu légitime, et les deux lancers
  // par attente empêchent de le vider d'un coup.
  // Voir specs/bonus.md#catalogue.
  it('peut faire passer le pool sous le seuil, et l attente mène alors à une reprise', async () => {
    await fillPool(rules.poolSizeForRecovery)

    await castPurge()

    const state = await readGameState(db, await reload(), WAIT_OVER)
    expect(state.phase).toBe('ascent')
    expect(state.lives).toBe(rules.lives)
  })

  it('laisse le rattrapage s ouvrir tant que le pool tient le seuil', async () => {
    await fillPool(rules.poolSizeForRecovery + 1)

    await castPurge()
    await serveNextQuestion(db, await reload(), WAIT_OVER)

    expect((await readGameState(db, await reload(), WAIT_OVER)).phase).toBe('recovery')
  })

  it('se lit sur l écran d attente, et au journal du lanceur', async () => {
    await fillPool(2)

    await castPurge()

    const state = await readGameState(db, await reload(), NOW)
    expect(state.effects).toMatchObject([{ spell: 'PURGE', face: 'boon', state: 'pending' }])
  })
})
