import { and, eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { activeEffects, inventory, missedPool, users } from '../../server/db/schema'
import { anchorEffects, castSpell, effectsQuery, toEffectViews } from '../../server/utils/effects'
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

describe('magie noire, sur un ennemi', () => {
  let db: Database
  let caster: User

  beforeEach(async () => {
    db = await createTestDatabase()
    // Un étage qui a encore de quoi jouer : sans deck, tout le monde serait au
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

  /** Un joueur de l'équipe adverse, en pleine ascension sauf mention contraire. */
  async function enemy(state: Parameters<typeof createPlayer>[1] = {}): Promise<User> {
    const id = await createPlayer(db, {
      discordId: 'enemy',
      username: 'saroumane',
      team: 'AZURE',
      floorSeen: 1,
      ...state,
    })

    return loadPlayer(db, id)
  }

  /** Un exemplaire en poche, puis lancé sur la catégorie Ennemi. */
  async function strike(spell: SpellId): Promise<void> {
    await db.insert(inventory).values({ userId: caster.id, spell, obtainedAt: NOW })
    await castSpell(db, await loadPlayer(db, caster.id), spell, 'foe', NOW)
  }

  it('grave la face noire sur la cible tirée', async () => {
    const target = await enemy()

    await strike('VITALITY')

    const fresh = await loadPlayer(db, target.id)
    expect(toEffectViews(await effectsQuery(db, target.id), fresh)).toEqual([
      { spell: 'VITALITY', face: 'curse', casterName: 'gandalf', state: 'pending', lifetime: 'attempt' },
    ])
  })

  // Vitalité noire : une vie de moins à la tentative qui s'ouvre. La limite de
  // deux effets négatifs garantit qu'il en reste au moins une.
  // Voir specs/mecanique.md#ce-que-les-sorts-modifient.
  it('ouvre la prochaine tentative de la cible avec une vie de moins', async () => {
    const target = await enemy()

    await strike('VITALITY')

    const opened = await anchorEffects(db, await loadPlayer(db, target.id), NOW)
    expect(opened.lives).toBe(rules.lives - 1)
  })

  // Répit noir : l'attente en cours de la cible, rallongée du même facteur que
  // la blanche la raccourcit. Voir specs/bonus.md#catalogue.
  it('rallonge l attente en cours de la cible', async () => {
    const target = await enemy({ lives: 0, cooldownUntil: FULL_DEADLINE })

    await strike('RESPITE')

    const struck = await loadPlayer(db, target.id)
    expect(struck.cooldownUntil?.getTime())
      .toBe(target.cooldownStartedAt!.getTime() + rules.cooldownMs * rules.respiteFactor)
  })

  // Purge noire : elle ne sort rien du Pool Échecs, elle remet à zéro le
  // compteur de réussites d'une de ses questions. Voir specs/bonus.md#catalogue.
  it('remet à zéro le compteur de réussites d une question du Pool Échecs', async () => {
    const target = await enemy()
    const questionId = await missQuestion(target.id, 1)

    await strike('PURGE')

    const [entry] = await db
      .select()
      .from(missedPool)
      .where(and(eq(missedPool.userId, target.id), eq(missedPool.questionId, questionId)))

    expect(entry.poolSuccesses).toBe(0)
  })

  it('laisse la question dans le pool : la noire ne purge pas', async () => {
    const target = await enemy()
    await missQuestion(target.id, 1)

    await strike('PURGE')

    expect(await db.select().from(missedPool).where(eq(missedPool.userId, target.id)))
      .toHaveLength(1)
  })

  // Sur un pool vide il n'y a pas de compteur à remettre à zéro : le sort part,
  // ne fait rien, et ne lève rien. Voir specs/bonus.md#catalogue.
  it('est gaspillée sur un Pool Échecs vide, sans erreur', async () => {
    await enemy()

    await strike('PURGE')

    expect(await db.select().from(activeEffects)).toHaveLength(1)
  })

  // La victime lit son agresseur sur son propre écran d'attente : tout est
  // révélé, nominativement, des deux côtés.
  // Voir specs/bonus.md#ce-que-voit-la-cible-et-ce-que-voit-le-lanceur.
  it('se lit sur l écran d attente de la victime, nom du lanceur compris', async () => {
    const target = await enemy({ lives: 0, cooldownUntil: FULL_DEADLINE })

    await strike('CHRONOMANCY')

    const state = await readGameState(db, await loadPlayer(db, target.id), NOW)
    expect(state.effects).toMatchObject([
      { spell: 'CHRONOMANCY', face: 'curse', casterName: 'gandalf', state: 'pending', lifetime: 'attempt' },
    ])
  })

  // Tous les ennemis saturés : le pool est vide comme s'il n'y avait personne.
  // Le sort part, l'exemplaire est dépensé, et rien n'est touché.
  // Voir specs/bonus.md#limite-deffets-négatifs.
  it('part sans toucher personne quand tous les ennemis sont saturés', async () => {
    const target = await enemy()
    // Frappé par quelqu'un d'autre : le budget de lancers de gandalf, lui, doit
    // rester entier — c'est le tirage qu'on éprouve ici, pas le plafond.
    const other = await createPlayer(db, { discordId: 'other', username: 'radagast', team: 'CRIMSON' })
    await db.insert(activeEffects).values(Array.from({ length: rules.maxCurses }, () => ({
      userId: target.id,
      casterId: other,
      spell: 'VITALITY' as const,
      face: 'curse' as const,
      castAt: NOW,
      castCooldownStartedAt: NOW,
    })))

    await strike('VITALITY')

    expect(await db.select().from(inventory).where(eq(inventory.userId, caster.id))).toHaveLength(0)
    const posed = await db.select().from(activeEffects).where(eq(activeEffects.castAt, NOW))
    expect(posed.filter(row => row.userId === null)).toHaveLength(1)
    // Ce qu'il portait n'a pas bougé : il en porte toujours deux, pas trois.
    expect(posed.filter(row => row.userId === target.id)).toHaveLength(rules.maxCurses)
  })

  // Le lanceur sans équipe n'a pas d'ennemis : rien ne part.
  it('ne dépense rien quand le lanceur n a pas d équipe', async () => {
    await enemy()
    await db.update(users).set({ team: null }).where(eq(users.id, caster.id))

    await strike('VITALITY')

    expect(await db.select().from(inventory).where(eq(inventory.userId, caster.id))).toHaveLength(1)
    expect(await db.select().from(activeEffects)).toHaveLength(0)
  })

  /** Une question ratée du joueur, avec le compteur de réussites demandé. */
  async function missQuestion(userId: number, poolSuccesses: number): Promise<string> {
    const questionId = await createQuestion(db, { statement: `Ratée de ${userId} ?`, accepted: ['non'] })
    await markSeen(db, userId, questionId, { floor: 1, correct: false })
    await db.insert(missedPool).values({
      userId,
      questionId,
      floor: 1,
      lastFailedAt: NOW,
      poolSuccesses,
    })

    return questionId
  }
})
