import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { activeEffects, inventory, missedPool, users } from '../../server/db/schema'
import { readGameState } from '../../server/utils/game'
import { castSpell, readCastLog } from '../../server/utils/effects'
import { rulesForFloor } from '../../server/utils/rules'
import { createPlayer, createQuestion, createTestDatabase, loadPlayer, markSeen } from '../helpers/db'
import { installNitroGlobals } from '../helpers/nitro'
import type { Database } from '../../server/db/client'
import type { User } from '../../server/db/schema'

installNitroGlobals()

const NOW = new Date('2026-09-06T12:00:00.000Z')
const rules = rulesForFloor(1)

/** L'attente telle qu'elle vient de s'ouvrir : elle court depuis maintenant. */
const STARTED_AT = NOW
const FULL_DEADLINE = new Date(NOW.getTime() + rules.cooldownMs)

describe('Répit, sur l attente en cours', () => {
  let db: Database
  let player: User

  beforeEach(async () => {
    db = await createTestDatabase()
    // Le helper en déduit le début et la durée : une attente ordinaire, celle
    // d'une dernière vie perdue.
    const id = await createPlayer(db, { lives: 0, cooldownUntil: FULL_DEADLINE })
    player = await loadPlayer(db, id)
    // Une question encore à voir : sans elle l'étage serait fini, et le palier
    // primerait sur l'attente.
    await createQuestion(db, { statement: 'Encore à voir ?', accepted: ['oui'] })
  })

  const reload = (): Promise<User> => loadPlayer(db, player.id)

  /** Un exemplaire en poche, puis lancé sur soi pendant l'attente. */
  async function castRespite(at: Date = NOW): Promise<void> {
    await db.insert(inventory).values({ userId: player.id, spell: 'RESPITE', obtainedAt: at })
    await castSpell(db, await reload(), 'RESPITE', 'self', at)
  }

  it('recalcule l échéance depuis le début de l attente', async () => {
    await castRespite()

    expect((await reload()).cooldownUntil?.getTime())
      .toBe(STARTED_AT.getTime() + rules.cooldownMs / rules.respiteFactor)
  })

  // Depuis le début, et non sur ce qu'il reste : un Répit lancé tard vaut
  // exactement autant qu'un Répit lancé tôt.
  it('vaut la même chose lancé tard que lancé tôt', async () => {
    await castRespite(new Date(NOW.getTime() + rules.cooldownMs / 2))

    expect((await reload()).cooldownUntil?.getTime())
      .toBe(STARTED_AT.getTime() + rules.cooldownMs / rules.respiteFactor)
  })

  it('laisse le début de l attente là où il est', async () => {
    await castRespite()

    expect((await reload()).cooldownStartedAt?.getTime()).toBe(STARTED_AT.getTime())
  })

  // Deux fois le même sort permis, jusqu'au plafond d'effets positifs : un
  // joueur peut donc diviser sa propre attente par quatre, sans attendre les
  // équipes. Voir specs/bonus.md#cumul.
  it('divise par quatre quand le joueur en lance deux', async () => {
    await castRespite()
    await castRespite()

    expect((await reload()).cooldownUntil?.getTime())
      .toBe(STARTED_AT.getTime() + rules.cooldownMs / (rules.respiteFactor ** 2))
  })

  // Deux Répit sur soi, et le joueur porte son plafond d'effets positifs : le
  // troisième ne part pas. Voir specs/bonus.md#limite-deffets-positifs.
  it('s arrête au plafond d effets positifs : le troisième ne part pas', async () => {
    await castRespite()
    await castRespite()
    await castRespite()

    const cast = await db.select().from(activeEffects).where(eq(activeEffects.userId, player.id))
    expect(cast).toHaveLength(rules.maxBoons)
    expect((await reload()).cooldownUntil?.getTime())
      .toBe(STARTED_AT.getTime() + rules.cooldownMs / (rules.respiteFactor ** 2))
  })

  it('se lit sur l état de jeu tout de suite', async () => {
    await castRespite()

    const state = await readGameState(db, await reload(), NOW)
    expect(state.cooldownUntil)
      .toBe(new Date(STARTED_AT.getTime() + rules.cooldownMs / rules.respiteFactor).toISOString())
  })

  it('chiffre sur l effet la durée d origine et la durée réelle de l attente', async () => {
    await castRespite()

    const { effects } = await readGameState(db, await reload(), NOW)
    expect(effects[0]?.stake).toEqual({
      rule: 'cooldownMs',
      before: rules.cooldownMs,
      after: rules.cooldownMs / rules.respiteFactor,
    })
  })

  it('apparaît dans le récapitulatif de l attente', async () => {
    await castRespite()

    const state = await readGameState(db, await reload(), NOW)
    expect(state.effects).toMatchObject([{ spell: 'RESPITE', face: 'boon', state: 'pending' }])
  })

  it('apparaît au journal du lanceur', async () => {
    await castRespite()

    expect(await readCastLog(db, await reload()))
      .toMatchObject([{ spell: 'RESPITE', face: 'boon', targetName: 'gandalf' }])
  })

  // Une attente annulée entre-temps — une vie rendue par l'admin, une
  // contestation acceptée — ne laisse rien à raccourcir.
  // Voir specs/validation.md#contestation.
  it('est gaspillé quand l attente n existe plus', async () => {
    await db
      .update(users)
      .set({ lives: 1, cooldownUntil: null, cooldownStartedAt: null, cooldownBaseMs: null })
      .where(eq(users.id, player.id))

    await castRespite()

    expect(await db.select().from(activeEffects)).toHaveLength(0)
    expect((await reload()).cooldownUntil).toBeNull()
  })

  describe('ce que l attente raccourcie ne dispense pas', () => {
    /** Remplit le Pool Échecs de quoi tirer un rattrapage. */
    async function fillPool(size: number): Promise<void> {
      for (let i = 0; i < size; i++) {
        const questionId = await createQuestion(db, { statement: `Ratée ${i} ?`, accepted: [`r${i}`] })
        await markSeen(db, player.id, questionId, { floor: 1, correct: false })
        await db.insert(missedPool).values({
          userId: player.id,
          questionId,
          floor: 1,
          lastFailedAt: NOW,
        })
      }
    }

    it('ouvre le rattrapage à l échéance réduite, comme à une échéance pleine', async () => {
      await fillPool(rules.poolSizeForRecovery)
      await castRespite()

      const shortened = new Date(STARTED_AT.getTime() + rules.cooldownMs / rules.respiteFactor)
      const state = await readGameState(db, await reload(), shortened)

      expect(state.phase).toBe('recovery')
    })

    it('tient encore l attente juste avant l échéance réduite', async () => {
      await fillPool(rules.poolSizeForRecovery)
      await castRespite()

      const justBefore = new Date(STARTED_AT.getTime() + rules.cooldownMs / rules.respiteFactor - 1_000)
      const state = await readGameState(db, await reload(), justBefore)

      expect(state.phase).toBe('cooldown')
    })
  })

  // Toutes les attentes ne durent pas pareil : celle qui suit un rattrapage
  // entièrement manqué est plus courte. Recalculer sur la durée de l'autre la
  // rallongerait — Répit punirait au lieu d'aider.
  // Voir specs/mecanique.md#règles-chiffrées.
  describe('sur une attente qui ne dure pas douze heures', () => {
    it('raccourcit l attente d après rattrapage manqué, sans jamais l allonger', async () => {
      const shortCooldown = rules.cooldownAfterFailedRecoveryMs
      await db
        .update(users)
        .set({
          cooldownStartedAt: STARTED_AT,
          cooldownUntil: new Date(STARTED_AT.getTime() + shortCooldown),
          cooldownBaseMs: shortCooldown,
        })
        .where(eq(users.id, player.id))

      await castRespite()

      const after = (await reload()).cooldownUntil!.getTime()
      expect(after).toBe(STARTED_AT.getTime() + shortCooldown / rules.respiteFactor)
      expect(after).toBeLessThan(STARTED_AT.getTime() + shortCooldown)
    })
  })

  // Un Répit a agi sur son attente : il n'a rien à attendre ensuite. Le laisser
  // traîner ferait annoncer une attente écourtée qu'il n'a pas touchée, et
  // poserait une icône d'effet actif sur une ascension qu'il ne module pas.
  describe('une fois l attente passée', () => {
    it('ne suit pas le joueur sur l attente suivante', async () => {
      await castRespite()

      // Un rattrapage entièrement manqué ouvre une seconde attente sans ouvrir
      // de tentative : rien ne s'ancre, et le Répit d'avant ne doit pas suivre.
      const nextStart = new Date(NOW.getTime() + rules.cooldownMs)
      await db
        .update(users)
        .set({
          cooldownStartedAt: nextStart,
          cooldownUntil: new Date(nextStart.getTime() + rules.cooldownAfterFailedRecoveryMs),
          cooldownBaseMs: rules.cooldownAfterFailedRecoveryMs,
        })
        .where(eq(users.id, player.id))

      const state = await readGameState(db, await reload(), nextStart)
      expect(state.effects).toEqual([])
    })

    it('reste au journal du lanceur, qui garde trace de ce qu il a envoyé', async () => {
      await castRespite()
      await db
        .update(users)
        .set({ cooldownStartedAt: new Date(NOW.getTime() + rules.cooldownMs) })
        .where(eq(users.id, player.id))

      expect(await readCastLog(db, await reload())).toHaveLength(1)
    })
  })
})
