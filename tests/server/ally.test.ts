import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { activeEffects, inventory, missedPool, users } from '../../server/db/schema'
import {
  castSpell,
  castsLeftThisWait,
  effectsQuery,
  readCastLog,
  readReceivedLog,
  toEffectViews,
} from '../../server/utils/effects'
import { readGameState } from '../../server/utils/game'
import { rulesForFloor } from '../../server/utils/rules'
import { createPlayer, createQuestion, createTestDatabase, loadPlayer, markSeen } from '../helpers/db'
import { installNitroGlobals } from '../helpers/nitro'
import type { Database } from '../../server/db/client'
import type { User } from '../../server/db/schema'
import type { SpellId } from '../../shared/utils/spells'

installNitroGlobals()

const NOW = new Date('2026-09-06T12:00:00.000Z')
const rules = rulesForFloor(1)
const FULL_DEADLINE = new Date(NOW.getTime() + rules.cooldownMs)

describe('lancer sur un allié', () => {
  let db: Database
  let caster: User

  beforeEach(async () => {
    db = await createTestDatabase()
    // Un étage qui contient de quoi jouer : sans deck, tout le monde serait au
    // palier et personne ne serait éligible.
    await createQuestion(db, { statement: 'Encore à voir ?', accepted: ['oui'] })

    const id = await createPlayer(db, {
      discordId: 'caster',
      username: 'gandalf',
      team: 'CRIMSON',
      floorSeen: 1,
      lives: 0,
      cooldownUntil: FULL_DEADLINE,
    })
    caster = await loadPlayer(db, id)
  })

  /** Un coéquipier, en pleine ascension sauf mention contraire. */
  async function ally(name: string, state: Parameters<typeof createPlayer>[1] = {}): Promise<User> {
    const id = await createPlayer(db, {
      discordId: `ally-${name}`,
      username: name,
      team: 'CRIMSON',
      floorSeen: 1,
      ...state,
    })

    return loadPlayer(db, id)
  }

  /** Un exemplaire en poche, puis lancé sur la catégorie Allié. */
  async function cast(spell: SpellId, at: Date = NOW): Promise<void> {
    await db.insert(inventory).values({ userId: caster.id, spell, obtainedAt: at })
    await castSpell(db, await loadPlayer(db, caster.id), spell, 'ally', at)
  }

  /** Les effets vivants d'un joueur, tels que son écran les lit. */
  async function effectsOn(user: User): Promise<unknown[]> {
    return toEffectViews(await effectsQuery(db, user.id), await loadPlayer(db, user.id))
  }

  it('pose l effet sur l allié tiré, jamais sur le lanceur', async () => {
    const samsagace = await ally('samsagace')

    await cast('VITALITY')

    expect(await effectsOn(samsagace)).toEqual([
      { spell: 'VITALITY', face: 'boon', casterName: 'gandalf', state: 'pending', lifetime: 'attempt' },
    ])
    expect(await effectsOn(caster)).toEqual([])
  })

  // Pool vide : le sort part et ne fait rien. Gaspillé, comme Purge sur un Pool
  // Échecs vide. Voir specs/bonus.md#tirage-de-la-cible.
  it('dépense l exemplaire et le lancer même sans cible éligible', async () => {
    await cast('VITALITY')

    expect(await db.select().from(inventory).where(eq(inventory.userId, caster.id))).toHaveLength(0)
    expect(await castsLeftThisWait(db, await loadPlayer(db, caster.id)))
      .toBe(rules.castsPerCooldown - 1)

    const [posed] = await db.select().from(activeEffects)
    expect(posed.userId).toBeNull()
  })

  // La cible lit sur son propre écran d'attente ce qu'elle a reçu, et de qui.
  // Voir specs/bonus.md#ce-que-voit-la-cible-et-ce-que-voit-le-lanceur.
  it('se lit sur l écran d attente de la cible, nom du lanceur compris', async () => {
    const waiting = await ally('samsagace', { lives: 0, cooldownUntil: FULL_DEADLINE })

    await cast('VITALITY')

    const state = await readGameState(db, await loadPlayer(db, waiting.id), NOW)
    expect(state.effects).toMatchObject([
      { spell: 'VITALITY', face: 'boon', casterName: 'gandalf', state: 'pending', lifetime: 'attempt' },
    ])
  })

  // Sans équipe, la catégorie n'existe pas pour lui : elle ne lui est pas
  // proposée, et l'URL ne la lui vend pas non plus — l'exemplaire reste en
  // poche. Voir specs/equipes.md#le-joueur-sans-équipe.
  it('ne dépense rien quand le lanceur n a pas d équipe', async () => {
    await ally('samsagace')
    await db.update(users).set({ team: null }).where(eq(users.id, caster.id))

    await cast('VITALITY')

    expect(await db.select().from(inventory).where(eq(inventory.userId, caster.id))).toHaveLength(1)
    expect(await db.select().from(activeEffects)).toHaveLength(0)
  })

  it('dit au lanceur qui il a touché, et à la cible de qui elle le tient', async () => {
    const samsagace = await ally('samsagace')

    await cast('VITALITY')

    expect(await readCastLog(db, await loadPlayer(db, caster.id)))
      .toMatchObject([{ spell: 'VITALITY', targetName: 'samsagace' }])
    expect(await readReceivedLog(db, samsagace))
      .toMatchObject([{ spell: 'VITALITY', face: 'boon', casterName: 'gandalf' }])
  })

  it('nomme personne au journal quand le tirage n a désigné personne', async () => {
    await cast('VITALITY')

    expect(await readCastLog(db, await loadPlayer(db, caster.id)))
      .toMatchObject([{ spell: 'VITALITY', targetName: null }])
  })

  it('ne montre pas au lanceur ce qu il a lancé sur lui-même comme reçu', async () => {
    await db.insert(inventory).values({ userId: caster.id, spell: 'VITALITY', obtainedAt: NOW })
    await castSpell(db, caster, 'VITALITY', 'self', NOW)

    expect(await readReceivedLog(db, await loadPlayer(db, caster.id))).toEqual([])
  })

  // Le déclencheur en cours est celui de la cible : c'est son attente à elle que
  // le Répit raccourcit. Voir specs/bonus.md#ancrage-et-durée-de-vie.
  it('raccourcit l attente de l allié, pas celle du lanceur', async () => {
    const waiting = await ally('samsagace', { lives: 0, cooldownUntil: FULL_DEADLINE })

    await cast('RESPITE')

    const target = await loadPlayer(db, waiting.id)
    expect(target.cooldownUntil?.getTime())
      .toBe(waiting.cooldownStartedAt!.getTime() + rules.cooldownMs / rules.respiteFactor)
    expect((await loadPlayer(db, caster.id)).cooldownUntil?.getTime())
      .toBe(FULL_DEADLINE.getTime())
  })

  it('vide une ligne du Pool Échecs de l allié, pas de celui du lanceur', async () => {
    const samsagace = await ally('samsagace')
    await missQuestion(samsagace.id)
    await missQuestion(caster.id)

    await cast('PURGE')

    expect(await db.select().from(missedPool).where(eq(missedPool.userId, samsagace.id))).toHaveLength(0)
    expect(await db.select().from(missedPool).where(eq(missedPool.userId, caster.id))).toHaveLength(1)
  })

  // Un sort lié à l'attente n'a rien à mordre chez qui n'en vit pas : il part,
  // et le journal le dit. Voir specs/bonus.md#ancrage-et-durée-de-vie.
  it('ne fait rien d un sort lié à l attente sur un allié qui n attend pas', async () => {
    const climbing = await ally('samsagace')

    await cast('RESPITE')

    expect(await effectsOn(climbing)).toEqual([])
    expect((await loadPlayer(db, climbing.id)).cooldownUntil).toBeNull()
  })

  /** Une question ratée, dans le Pool Échecs de ce joueur-là. */
  async function missQuestion(userId: number): Promise<void> {
    const questionId = await createQuestion(db, { statement: `Ratée de ${userId} ?`, accepted: ['non'] })
    await markSeen(db, userId, questionId, { floor: 1, correct: false })
    await db.insert(missedPool).values({ userId, questionId, floor: 1, lastFailedAt: NOW })
  }
})
