import { describe, expect, it } from 'vitest'
import { navIcons } from '../../utils/nav'
import type { NavIcon, NavIconKey } from '../../utils/nav'
import type { GameState } from '../../server/utils/game'

function state(overrides: Partial<GameState>): GameState {
  return {
    phase: 'ascent',
    floor: 1,
    lives: 3,
    maxLives: 3,
    started: true,
    question: null,
    verdict: null,
    cooldownUntil: null,
    recovery: null,
    recoveryResult: null,
    floorSeen: 0,
    floorTotal: 0,
    attemptSeen: 0,
    chest: null,
    maintenance: false,
    effects: [],
    unlocked: [],
    ...overrides,
  }
}

const question = {
  id: 'q1',
  statement: 'Capitale de la Gironde ?',
  expiresAt: '2026-09-05T12:00:20.000Z',
  focusGraceMs: 2000,
  lootQuestion: false,
}

function keys(icons: NavIcon[]): NavIconKey[] {
  return icons.map(icon => icon.key)
}

function stateOf(icons: NavIcon[], key: NavIconKey): string | undefined {
  return icons.find(icon => icon.key === key)?.state
}

describe('composition de la barre', () => {
  it('porte la tour, la baguette, la coupe et le profil pour un joueur', () => {
    const icons = navIcons({ path: '/profil', isAdmin: false, game: state({}) })

    expect(keys(icons)).toEqual(['tower', 'wand', 'trophy', 'profile'])
  })

  it('ajoute le bouclier pour un admin', () => {
    const icons = navIcons({ path: '/profil', isAdmin: true, game: state({}) })

    expect(keys(icons)).toEqual(['tower', 'wand', 'trophy', 'profile', 'admin'])
  })

  it('reste debout tant que l état de jeu n a pas été lu', () => {
    const icons = navIcons({ path: '/profil', isAdmin: false, game: null })

    expect(keys(icons)).toEqual(['tower', 'wand', 'trophy', 'profile'])
    expect(stateOf(icons, 'tower')).toBe('link')
  })
})

describe('page courante', () => {
  it('met en avant l icône de la page regardée, qui ne mène nulle part', () => {
    const icons = navIcons({ path: '/profil', isAdmin: false, game: state({}) })

    expect(stateOf(icons, 'profile')).toBe('active')
    expect(stateOf(icons, 'tower')).toBe('link')
  })

  it('met la tour en avant sur le jeu', () => {
    const icons = navIcons({ path: '/', isAdmin: false, game: state({}) })

    expect(stateOf(icons, 'tower')).toBe('active')
  })

  it('met la baguette en avant sur les Sorts', () => {
    const icons = navIcons({ path: '/sorts', isAdmin: false, game: state({ phase: 'cooldown', lives: 0 }) })

    expect(stateOf(icons, 'wand')).toBe('active')
  })
})

describe('chrono qui tourne', () => {
  it('éteint toute la barre pendant une question d ascension', () => {
    const icons = navIcons({
      path: '/',
      isAdmin: true,
      game: state({ phase: 'ascent', question }),
    })

    // « Toute la barre », et non un nombre d icônes : ce qu on veut tenir est
    // qu aucune ne reste allumée, quelles qu elles soient.
    expect(icons.length).toBeGreaterThan(0)
    expect(icons.every(icon => icon.state === 'disabled')).toBe(true)
  })

  it('éteint toute la barre pendant une question de rattrapage', () => {
    const icons = navIcons({
      path: '/',
      isAdmin: false,
      game: state({ phase: 'recovery', lives: 0, question }),
    })

    expect(icons.length).toBeGreaterThan(0)
    expect(icons.every(icon => icon.state === 'disabled')).toBe(true)
  })

  it('laisse la barre vivante ailleurs, même si une question est restée en cache', () => {
    const icons = navIcons({
      path: '/profil',
      isAdmin: false,
      game: state({ phase: 'ascent', question }),
    })

    expect(stateOf(icons, 'tower')).toBe('link')
  })

  it('rend ses liens sur le verdict, le palier et la fin de partie', () => {
    for (const phase of ['ascent', 'floorEnd', 'gameOver'] as const) {
      const icons = navIcons({ path: '/', isAdmin: false, game: state({ phase, question: null }) })

      expect(stateOf(icons, 'profile')).toBe('link')
    }
  })
})

describe('baguette', () => {
  it('mène aux Sorts pendant l attente', () => {
    const icons = navIcons({ path: '/', isAdmin: false, game: state({ phase: 'cooldown', lives: 0 }) })

    expect(stateOf(icons, 'wand')).toBe('link')
  })

  it('est éteinte partout ailleurs', () => {
    for (const phase of ['ascent', 'recovery', 'floorEnd', 'gameOver'] as const) {
      const icons = navIcons({ path: '/profil', isAdmin: false, game: state({ phase }) })

      expect(stateOf(icons, 'wand')).toBe('disabled')
    }
  })

  it('est éteinte tant que l état de jeu n a pas été lu', () => {
    const icons = navIcons({ path: '/profil', isAdmin: false, game: null })

    expect(stateOf(icons, 'wand')).toBe('disabled')
  })
})
