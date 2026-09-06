import { beforeEach, describe, expect, it } from 'vitest'
import { activeEffects } from '../../server/db/schema'
import { rulesForFloor } from '../../server/utils/rules'
import { drawTarget } from '../../server/utils/targets'
import { createPlayer, createQuestion, createTestDatabase, loadPlayer } from '../helpers/db'
import { installNitroGlobals } from '../helpers/nitro'
import { rolls } from '../helpers/random'
import type { Database } from '../../server/db/client'
import type { SpellFace } from '../../shared/utils/spells'
import type { TeamId } from '../../shared/utils/teams'

installNitroGlobals()

const NOW = new Date('2026-09-06T12:00:00.000Z')
const COOLDOWN_UNTIL = new Date('2026-09-07T00:00:00.000Z')
const rules = rulesForFloor(1)

interface AllySeed {
  team?: TeamId | null
  isTest?: boolean
  currentFloor?: number
  floorSeen?: number
  createdAt?: Date
}

describe('tirage de la cible', () => {
  let db: Database
  let caster: number
  let nextId: number

  beforeEach(async () => {
    db = await createTestDatabase()
    nextId = 0

    // Un étage qui contient de quoi jouer : sans deck, tout le monde serait au
    // palier et personne ne serait éligible.
    await createQuestion(db, { floor: 1 })
    await createQuestion(db, { floor: 1 })
    await createQuestion(db, { floor: 1 })

    caster = await createPlayer(db, {
      discordId: 'caster',
      username: 'gandalf',
      team: 'CRIMSON',
      floorSeen: 1,
      lives: 0,
      cooldownUntil: COOLDOWN_UNTIL,
    })
  })

  /** Un joueur du monde réel, à mi-étage sauf mention contraire. */
  async function player(name: string, seed: AllySeed = {}): Promise<number> {
    nextId += 1

    return createPlayer(db, {
      discordId: `player-${nextId}`,
      username: name,
      team: 'CRIMSON',
      currentFloor: 1,
      floorSeen: 1,
      ...seed,
    })
  }

  /** Le nom que le tirage désigne pour ce dé-là, null quand le pool est vide. */
  async function draw(roll: number): Promise<string | null> {
    const target = await drawTarget(db, await loadPlayer(db, caster), 'ally', NOW, rolls(roll))

    return target?.username ?? null
  }

  it('ne tire que dans l équipe du lanceur', async () => {
    await player('samsagace')
    await player('saroumane', { team: 'AZURE' })

    expect(await draw(0)).toBe('samsagace')
    expect(await draw(0.999)).toBe('samsagace')
  })

  it('ne se tire jamais lui-même, et ne rend alors personne', async () => {
    expect(await draw(0.5)).toBeNull()
  })

  // Sans équipe, aucune relation ne relie les deux joueurs : ni allié, ni ennemi.
  // Voir specs/equipes.md#le-joueur-sans-équipe.
  it('écarte le joueur sans équipe', async () => {
    await player('radagast', { team: null })

    expect(await draw(0.5)).toBeNull()
  })

  // Deux mondes, jamais un seul : un fantôme n'a ni allié ni ennemi parmi les
  // vivants. Voir specs/admin.md#joueurs-test.
  it('ne mélange pas les joueurs test et les vrais', async () => {
    await player('doublure', { isTest: true })

    expect(await draw(0.5)).toBeNull()
  })

  // Il n'aura jamais de prochaine tentative : l'effet serait mort-né.
  it('écarte un joueur en fin de partie', async () => {
    await createQuestion(db, { floor: 6 })
    await player('arrivé', { currentFloor: 6, floorSeen: 1 })

    expect(await draw(0.5)).toBeNull()
  })

  it('écarte un joueur qui n a jamais commencé', async () => {
    await player('nouveau', { floorSeen: 0 })

    expect(await draw(0.5)).toBeNull()
  })

  // On soutient le plus faible : le moins avancé porte le plus gros poids.
  // Voir specs/bonus.md#tirage-de-la-cible.
  it('classe par étage, puis par questions vues à l étage', async () => {
    await player('devant', { currentFloor: 2, floorSeen: 0 })
    await player('milieu', { floorSeen: 2 })
    await player('dernier', { floorSeen: 1 })

    expect(await draw(0)).toBe('dernier')
    expect(await draw(0.999)).toBe('devant')
  })

  it('départage deux égaux par l ancienneté du compte', async () => {
    await player('cadet', { createdAt: new Date('2026-09-05T00:00:00.000Z') })
    await player('ainé', { createdAt: new Date('2026-01-01T00:00:00.000Z') })

    expect(await draw(0)).toBe('ainé')
    expect(await draw(0.999)).toBe('cadet')
  })

  // On tape le plus fort : la même fonction que pour l'allié, lue à l'envers.
  // Voir specs/bonus.md#tirage-de-la-cible.
  describe('sur un ennemi', () => {
    /** Un joueur de l'équipe adverse. */
    async function enemy(name: string, seed: AllySeed = {}): Promise<number> {
      return player(name, { team: 'AZURE', ...seed })
    }

    /** Ce que le tirage désigne dans l'équipe adverse pour ce dé-là. */
    async function strike(roll: number): Promise<string | null> {
      const target = await drawTarget(db, await loadPlayer(db, caster), 'foe', NOW, rolls(roll))

      return target?.username ?? null
    }

    /** Un effet posé sur ce joueur : en attente de sa prochaine tentative. */
    async function put(userId: number, face: SpellFace, count = 1): Promise<void> {
      await db.insert(activeEffects).values(Array.from({ length: count }, () => ({
        userId,
        casterId: caster,
        spell: 'VITALITY' as const,
        face,
        castAt: NOW,
        castCooldownStartedAt: NOW,
      })))
    }

    it('ne tire que dans l équipe adverse', async () => {
      await player('samsagace')
      await enemy('saroumane')

      expect(await strike(0)).toBe('saroumane')
      expect(await strike(0.999)).toBe('saroumane')
    })

    it('vise en priorité le plus avancé', async () => {
      await enemy('devant', { currentFloor: 2, floorSeen: 0 })
      await enemy('dernier', { floorSeen: 1 })

      expect(await strike(0.999)).toBe('devant')
      expect(await strike(0)).toBe('dernier')
    })

    // Deux effets négatifs au plus. Le saturé sort du tirage sans que rien ne
    // l'indique au lanceur. Voir specs/bonus.md#limite-deffets-négatifs.
    it('écarte un ennemi qui porte déjà deux effets négatifs', async () => {
      const saturated = await enemy('blindé')
      await put(saturated, 'curse', rules.maxCurses)
      await enemy('exposé')

      expect(await strike(0)).toBe('exposé')
      expect(await strike(0.999)).toBe('exposé')
    })

    it('ne compte pas les effets positifs, qu il en porte dix', async () => {
      const blessed = await enemy('béni')
      await put(blessed, 'boon', 10)

      expect(await strike(0.5)).toBe('béni')
    })

    // Un effet mort avec la tentative qu'il a servie ne pèse plus : il n'est
    // plus porté. Voir specs/bonus.md#ancrage-et-durée-de-vie.
    it('ne compte pas un effet négatif déjà mort', async () => {
      const scarred = await enemy('rescapé')
      await db.insert(activeEffects).values(Array.from({ length: 2 }, () => ({
        userId: scarred,
        casterId: caster,
        spell: 'VITALITY' as const,
        face: 'curse' as const,
        castAt: NOW,
        castCooldownStartedAt: NOW,
        // Ancré sur une tentative que le joueur ne joue plus.
        anchoredAt: new Date('2026-01-01T00:00:00.000Z'),
      })))

      expect(await strike(0.5)).toBe('rescapé')
    })

    // Le filtre passe avant le classement : le saturé ne pèse plus dans la
    // distribution, il n'y occupe même plus de rang.
    it('rend le pool à ceux qui restent, sans laisser de trou', async () => {
      const saturated = await enemy('blindé', { currentFloor: 3 })
      await put(saturated, 'curse', rules.maxCurses)
      await enemy('devant', { currentFloor: 2 })
      await enemy('dernier', { floorSeen: 1 })

      // Deux éligibles : 1/3 pour le dernier, 2/3 pour celui de devant.
      expect(await strike(0.32)).toBe('dernier')
      expect(await strike(0.34)).toBe('devant')
    })

    it('ne rend personne quand tous les ennemis sont saturés', async () => {
      const first = await enemy('blindé')
      const second = await enemy('cuirassé')
      await put(first, 'curse', rules.maxCurses)
      await put(second, 'curse', rules.maxCurses)

      expect(await strike(0.5)).toBeNull()
    })
  })
})
