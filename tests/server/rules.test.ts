import { describe, expect, it } from 'vitest'
import { FLOOR_COUNT } from '../../shared/utils/floors'
import { rulesForFloor, rulesWithEffects } from '../../server/utils/rules'
import type { SpellEffect } from '../../shared/utils/spells'

const rules = rulesForFloor(1)

function vitality(face: SpellEffect['face'], count = 1): SpellEffect[] {
  return Array.from({ length: count }, () => ({ spell: 'VITALITY' as const, face }))
}

function respite(face: SpellEffect['face'], count = 1): SpellEffect[] {
  return Array.from({ length: count }, () => ({ spell: 'RESPITE' as const, face }))
}

describe('jeu de règles', () => {
  it('sert les valeurs par défaut du premier étage', () => {
    expect(rulesForFloor(1)).toMatchObject({
      lives: 3,
      ascentTimerMs: 60_000,
      recoveryTimerMs: 60_000,
      recoveryQuestions: 3,
      recoverySuccessesToResume: 1,
      poolSizeForRecovery: 3,
      poolSuccessesToLeave: 2,
      cooldownMs: 12 * 60 * 60 * 1000,
      cooldownAfterFailedRecoveryMs: 4 * 60 * 60 * 1000,
      latencyGraceMs: 1_000,
      questionsPerChest: 50,
      mimicChance: 0.05,
      respiteFactor: 2,
    })
  })

  it('répond pour chaque étage du jeu', () => {
    for (let floor = 1; floor <= FLOOR_COUNT; floor++) {
      expect(rulesForFloor(floor)).toEqual(rulesForFloor(1))
    }
  })
})

describe('règles modulées par les effets', () => {
  it('rend les règles de l étage quand rien n est posé', () => {
    expect(rulesWithEffects(rules, [])).toEqual(rules)
  })

  it('ajoute une vie par Vitalité blanche', () => {
    expect(rulesWithEffects(rules, vitality('boon')).lives).toBe(rules.lives + 1)
  })

  it('additionne deux Vitalité posées avant la même tentative', () => {
    expect(rulesWithEffects(rules, vitality('boon', 2)).lives).toBe(rules.lives + 2)
  })

  it('retire une vie par Vitalité noire', () => {
    expect(rulesWithEffects(rules, vitality('curse')).lives).toBe(rules.lives - 1)
  })

  it('compose les deux faces plutôt que de les annuler d office', () => {
    const both = [...vitality('boon', 2), ...vitality('curse')]

    expect(rulesWithEffects(rules, both).lives).toBe(rules.lives + 1)
  })

  it('ne touche à rien d autre que les vies', () => {
    const { lives: _lives, ...rest } = rulesWithEffects(rules, vitality('boon'))
    const { lives: _floorLives, ...floorRest } = rules

    expect(rest).toEqual(floorRest)
  })

  it('divise l attente par le facteur de Répit blanc', () => {
    expect(rulesWithEffects(rules, respite('boon')).cooldownMs)
      .toBe(rules.cooldownMs / rules.respiteFactor)
  })

  // Multiplicatif, et c'est ce qui garantit qu'aucun empilement ne ramène une
  // attente à zéro. Voir specs/bonus.md#cumul.
  it('multiplie les Répit blancs entre eux', () => {
    expect(rulesWithEffects(rules, respite('boon', 2)).cooldownMs)
      .toBe(rules.cooldownMs / (rules.respiteFactor ** 2))
  })

  it('rallonge l attente d autant en Répit noir', () => {
    expect(rulesWithEffects(rules, respite('curse')).cooldownMs)
      .toBe(rules.cooldownMs * rules.respiteFactor)
  })

  it('compose les deux faces de Répit plutôt que de les annuler d office', () => {
    const both = [...respite('boon', 2), ...respite('curse')]

    expect(rulesWithEffects(rules, both).cooldownMs)
      .toBe(rules.cooldownMs / rules.respiteFactor)
  })

  it('n atteint jamais zéro, quel qu en soit l empilement', () => {
    expect(rulesWithEffects(rules, respite('boon', 20)).cooldownMs).toBeGreaterThan(0)
  })

  it('ne touche à rien d autre que l attente', () => {
    const { cooldownMs: _cooldown, ...rest } = rulesWithEffects(rules, respite('boon'))
    const { cooldownMs: _floorCooldown, ...floorRest } = rules

    expect(rest).toEqual(floorRest)
  })

  it('module les vies et l attente ensemble, chacune selon son sort', () => {
    const mixed = [...vitality('boon'), ...respite('boon')]
    const modulated = rulesWithEffects(rules, mixed)

    expect(modulated.lives).toBe(rules.lives + 1)
    expect(modulated.cooldownMs).toBe(rules.cooldownMs / rules.respiteFactor)
  })
})
