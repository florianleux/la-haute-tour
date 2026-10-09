import { describe, expect, it } from 'vitest'
import { spellLifetime, spellStake } from '../../utils/spells'
import type { EffectView } from '../../server/utils/effects'
import type { GameState } from '../../server/utils/game'

function effect(overrides: Partial<EffectView>): EffectView {
  return { spell: 'VITALITY', face: 'boon', casterName: 'Bilbo', state: 'active', stake: null, ...overrides }
}

describe('valeur d un sort', () => {
  it('écrit une durée de règle en durée', () => {
    expect(spellStake({ rule: 'ascentTimerMs', before: 60_000, after: 240_000 }))
      .toEqual({ label: 'Temps de réponse', before: '1 min', after: '4 min' })
  })

  it('écrit un compte en nombre', () => {
    expect(spellStake({ rule: 'recoverySuccessesToResume', before: 1, after: 6 }))
      .toEqual({ label: 'Bonnes réponses exigées', before: '1', after: '6' })
  })
})

describe('durée d un sort', () => {
  const state = { lives: 2, cooldownUntil: '2026-09-01T16:42:00.000Z' } as GameState

  it('compte les vies qui restent à la tentative', () => {
    expect(spellLifetime(effect({ spell: 'CHRONOMANCY' }), state)).toBe('Jusqu\'à ta dernière vie perdue (encore 2 ♥)')
  })

  it('donne l heure de fin de l attente au Répit', () => {
    expect(spellLifetime(effect({ spell: 'RESPITE' }), state)).toBe('Jusqu\'à la fin de ton attente (18:42)')
  })

  it('dit qu un effet en attente n agit pas encore', () => {
    expect(spellLifetime(effect({ state: 'pending' }), state)).toBe('S\'active à ta prochaine tentative')
  })
})
