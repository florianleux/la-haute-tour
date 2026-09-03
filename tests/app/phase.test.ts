import { describe, expect, it } from 'vitest'
import { mainActionLabel, phaseMessage } from '../../utils/phase'
import type { GameState } from '../../server/utils/game'

function state(overrides: Partial<GameState>): GameState {
  return {
    phase: 'ascent',
    floor: 1,
    lives: 3,
    started: false,
    question: null,
    verdict: null,
    cooldownUntil: null,
    recovery: null,
    ...overrides,
  }
}

describe('action principale de l accueil', () => {
  it('propose de commencer tant que rien n a été joué', () => {
    expect(mainActionLabel(state({ phase: 'ascent', started: false }))).toBe('Commencer l\'ascension')
  })

  it('propose de reprendre une ascension entamée', () => {
    expect(mainActionLabel(state({ phase: 'ascent', started: true }))).toBe('Reprendre l\'ascension')
  })

  it('dit au joueur où il en est dans les phases pas encore mises en scène', () => {
    expect(phaseMessage('cooldown')).toContain('dernière vie')
    expect(phaseMessage('recovery')).toContain('rattrapage')
    expect(phaseMessage('floorEnd')).toContain('Étage terminé')
    expect(phaseMessage('gameOver')).toContain('La Haute Tour')
    // L'ascension a son propre écran : rien à dire à sa place.
    expect(phaseMessage('ascent')).toBe('')
  })

  it('annonce ce qui attend le joueur dans les autres phases', () => {
    expect(mainActionLabel(state({ phase: 'cooldown' }))).toBe('Voir l\'attente')
    expect(mainActionLabel(state({ phase: 'recovery' }))).toBe('Aller au rattrapage')
    expect(mainActionLabel(state({ phase: 'floorEnd' }))).toBe('Continuer vers l\'étage suivant')
    expect(mainActionLabel(state({ phase: 'gameOver' }))).toBe('Revoir la fin')
  })
})
