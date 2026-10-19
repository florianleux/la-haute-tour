import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { activeEffects, pocketSpells, missedPool, users } from '../../server/db/schema'
import { readGameState, serveNextQuestion, submitAnswer } from '../../server/utils/game'
import { castSpell } from '../../server/utils/effects'
import { openAttempt } from '../../server/utils/journey'
import { rulesForFloor } from '../../server/utils/rules'
import { createPlayer, createQuestion, createTestDatabase, loadPlayer, markSeen } from '../helpers/db'
import { installNitroGlobals } from '../helpers/nitro'
import type { Database } from '../../server/db/client'
import type { User } from '../../server/db/schema'

installNitroGlobals()

const NOW = new Date('2026-09-06T12:00:00.000Z')
const rules = rulesForFloor(1)

/** Le timer que la Chronomancie blanche accorde : le double du timer nu. */
const DOUBLED = rules.ascentTimerMs * rules.chronomancyFactor

describe('Chronomancie, sur toute la tentative', () => {
  let db: Database
  let player: User

  beforeEach(async () => {
    db = await createTestDatabase()
    const id = await createPlayer(db, {
      lives: 0,
      cooldownUntil: new Date(NOW.getTime() + rules.cooldownMs),
    })
    player = await loadPlayer(db, id)
    for (let i = 0; i < 6; i++) {
      await createQuestion(db, { statement: `Question ${i} ?`, accepted: [`reponse ${i}`] })
    }
  })

  const reload = (): Promise<User> => loadPlayer(db, player.id)

  /** Lancée pendant l'attente, comme tout sort : elle attend la tentative suivante. */
  async function castChronomancy(): Promise<void> {
    await db.insert(pocketSpells).values({ userId: player.id, spell: 'CHRONOMANCY', obtainedAt: NOW })
    await castSpell(db, await reload(), 'CHRONOMANCY', 'self', NOW)
  }

  /**
   * Ouvre la tentative pour de bon : c'est elle qui ancre ce qui attendait, et
   * l'ancrage est tout le sujet. Poser les vies à la main laisserait l'effet en
   * attente, donc sans prise sur les timers.
   */
  async function beginAttempt(): Promise<void> {
    await openAttempt(db, await reload(), NOW)
  }

  /**
   * Un Pool Échecs de quoi tirer, puis une attente échue : le rattrapage s'ouvre
   * à la lecture suivante. Rend la bonne réponse de chaque énoncé ainsi raté.
   */
  async function readyRecovery(): Promise<Map<string, string>> {
    const answers = new Map<string, string>()
    for (let i = 0; i < rules.poolSizeForRecovery; i++) {
      const statement = `Ratée ${i} ?`
      const questionId = await createQuestion(db, { statement, accepted: [`r${i}`] })
      await markSeen(db, player.id, questionId, { floor: 1, correct: false })
      await db.insert(missedPool).values({ userId: player.id, questionId, floor: 1, lastFailedAt: NOW })
      answers.set(statement, `r${i}`)
    }
    await db
      .update(users)
      .set({ lives: 0, cooldownUntil: new Date(NOW.getTime() - 1_000) })
      .where(eq(users.id, player.id))
    return answers
  }

  /** Le temps accordé par la question actuellement servie. */
  async function servedTimer(at: Date): Promise<number> {
    const state = await readGameState(db, await reload(), at)
    return new Date(state.question!.expiresAt).getTime() - at.getTime()
  }

  it('laisse le timer nu quand rien n est posé', async () => {
    await beginAttempt()
    await serveNextQuestion(db, await reload(), NOW)

    expect(await servedTimer(NOW)).toBe(rules.ascentTimerMs)
  })

  // L'effet porte sur la tentative, pas sur une question : la deuxième et la
  // troisième doivent en profiter autant que la première.
  // Voir specs/bonus.md#catalogue.
  it('double le timer de chaque question de la tentative, pas seulement la première', async () => {
    await castChronomancy()
    await beginAttempt()

    for (let i = 0; i < 3; i++) {
      const at = new Date(NOW.getTime() + i * 1_000)
      await serveNextQuestion(db, await reload(), at)
      expect(await servedTimer(at)).toBe(DOUBLED)

      await submitAnswer(db, await reload(), 'faux', at)
    }
  })

  it('double aussi le timer des questions de rattrapage', async () => {
    await castChronomancy()
    await beginAttempt()
    await readyRecovery()

    await serveNextQuestion(db, await reload(), NOW)

    expect(await servedTimer(NOW)).toBe(rules.recoveryTimerMs * rules.chronomancyFactor)
  })

  // Lancée pendant l'attente, elle n'agit pas sur le rattrapage, qui appartient
  // encore à la tentative finissante : elle attend celle que sa réussite ouvre,
  // dont la première question est réservée dans la foulée.
  it('double le timer de la première question servie après un rattrapage réussi', async () => {
    await castChronomancy()
    const answers = await readyRecovery()

    // Le rattrapage se joue au timer nu, jusqu'au verdict scellé.
    let state = await serveNextQuestion(db, await reload(), NOW)
    expect(state.phase).toBe('recovery')
    while (state.phase === 'recovery') {
      expect(await servedTimer(NOW)).toBe(rules.recoveryTimerMs)
      await submitAnswer(db, await reload(), answers.get(state.question!.statement)!, NOW)
      state = await serveNextQuestion(db, await reload(), NOW)
    }

    expect(state.phase).toBe('ascent')
    expect(await servedTimer(NOW)).toBe(DOUBLED)
  })

  it('reste arbitrée par le serveur : l échéance est fixée à la réservation', async () => {
    await castChronomancy()
    await beginAttempt()
    await serveNextQuestion(db, await reload(), NOW)

    const served = (await readGameState(db, await reload(), NOW)).question!.expiresAt

    // Relue plus tard, l'échéance ne bouge pas : elle a été gravée au tirage.
    const later = new Date(NOW.getTime() + 30_000)
    expect((await readGameState(db, await reload(), later)).question!.expiresAt).toBe(served)
  })

  it('affiche une icône d effet actif sur la question concernée', async () => {
    await castChronomancy()
    await beginAttempt()
    await serveNextQuestion(db, await reload(), NOW)

    const state = await readGameState(db, await reload(), NOW)
    expect(state.effects).toMatchObject([{ spell: 'CHRONOMANCY', face: 'boon', state: 'active' }])
  })

  it('chiffre sur l effet le timer de l étage et le timer joué', async () => {
    await castChronomancy()
    await beginAttempt()

    const state = await readGameState(db, await reload(), NOW)
    expect(state.effects[0]?.stake).toEqual({ rule: 'ascentTimerMs', before: rules.ascentTimerMs, after: DOUBLED })
  })

  it('ne chiffre pas un effet qui n agit pas encore', async () => {
    await castChronomancy()

    const state = await readGameState(db, await reload(), NOW)
    expect(state.effects).toMatchObject([{ state: 'pending', stake: null }])
  })

  // Une tentative ne se clôt qu'au moment où la suivante s'ouvre : l'attente et
  // le rattrapage qui la suivent en font partie. Perdre ses vies ne suffit donc
  // pas à tuer l'effet — sans quoi le rattrapage se jouerait au timer nu.
  // Voir server/utils/journey.ts.
  it('tient encore quand les vies sont tombées, avant la tentative suivante', async () => {
    await castChronomancy()
    await beginAttempt()
    await db.update(users).set({ lives: 0 }).where(eq(users.id, player.id))

    const state = await readGameState(db, await reload(), NOW)
    expect(state.effects).toMatchObject([{ spell: 'CHRONOMANCY', state: 'active' }])
  })

  it('meurt à l ouverture de la tentative suivante', async () => {
    await castChronomancy()
    await beginAttempt()

    // La suivante s'ouvre : l'ancre ne désigne plus la tentative en cours.
    await openAttempt(db, await reload(), new Date(NOW.getTime() + 60_000))

    expect((await readGameState(db, await reload(), NOW)).effects).toEqual([])
  })

  it('divise le timer en magie noire, sans jamais l annuler', async () => {
    await db.insert(activeEffects).values({
      userId: player.id,
      casterId: player.id,
      spell: 'CHRONOMANCY',
      face: 'curse',
      castAt: NOW,
      castCooldownStartedAt: NOW,
    })
    await beginAttempt()
    await serveNextQuestion(db, await reload(), NOW)

    const granted = await servedTimer(NOW)
    expect(granted).toBe(rules.ascentTimerMs / rules.chronomancyFactor)
    expect(granted).toBeGreaterThan(0)
  })
})
