import { beforeEach, describe, expect, it } from 'vitest'
import { drawTarget } from '../../server/utils/targets'
import { createPlayer, createQuestion, createTestDatabase, loadPlayer } from '../helpers/db'
import { installNitroGlobals } from '../helpers/nitro'
import { rolls } from '../helpers/random'
import type { Database } from '../../server/db/client'
import type { TeamId } from '../../shared/utils/teams'

installNitroGlobals()

const NOW = new Date('2026-09-06T12:00:00.000Z')
const COOLDOWN_UNTIL = new Date('2026-09-07T00:00:00.000Z')

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
})
