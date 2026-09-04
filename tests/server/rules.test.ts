import { describe, expect, it } from 'vitest'
import { FLOOR_COUNT } from '../../shared/utils/floors'
import { rulesForFloor } from '../../server/utils/rules'

describe('jeu de règles', () => {
  it('sert les valeurs par défaut du premier étage', () => {
    expect(rulesForFloor(1)).toMatchObject({
      lives: 3,
      ascentTimerMs: 20_000,
      recoveryTimerMs: 60_000,
      recoveryQuestions: 3,
      recoverySuccessesToResume: 1,
      poolSizeForRecovery: 3,
      poolSuccessesToLeave: 2,
      cooldownMs: 12 * 60 * 60 * 1000,
      cooldownAfterFailedRecoveryMs: 4 * 60 * 60 * 1000,
      latencyGraceMs: 1_000,
    })
  })

  it('répond pour chaque étage du jeu', () => {
    for (let floor = 1; floor <= FLOOR_COUNT; floor++) {
      expect(rulesForFloor(floor)).toEqual(rulesForFloor(1))
    }
  })
})
