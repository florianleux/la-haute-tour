import { describe, expect, it } from 'vitest'
import { FLOOR_COUNT } from '../../shared/utils/floors'
import { rulesForFloor } from '../../server/utils/rules'
import { rulesWithEffects } from '../../server/utils/spellbook'
import type { SpellEffect } from '../../shared/utils/spells'

const rules = rulesForFloor(1)

function vitality(face: SpellEffect['face'], count = 1): SpellEffect[] {
  return Array.from({ length: count }, () => ({ spell: 'VITALITY' as const, face }))
}

function respite(face: SpellEffect['face'], count = 1): SpellEffect[] {
  return Array.from({ length: count }, () => ({ spell: 'RESPITE' as const, face }))
}

function chronomancy(face: SpellEffect['face'], count = 1): SpellEffect[] {
  return Array.from({ length: count }, () => ({ spell: 'CHRONOMANCY' as const, face }))
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
      questionsPerChest: 25,
      mimicChance: 0.05,
      respiteFactor: 2,
      chronomancyFactor: 2,
      indulgenceFactor: 2,
      maxCurses: 2,
      maxBoons: 2,
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

  // Chronomancie porte sur les deux timers : l'effet vaut pour toute la
  // tentative, ascension et rattrapage compris.
  // Voir specs/bonus.md#catalogue.
  it('double les deux timers en Chronomancie blanche', () => {
    const modulated = rulesWithEffects(rules, chronomancy('boon'))

    expect(modulated.ascentTimerMs).toBe(rules.ascentTimerMs * rules.chronomancyFactor)
    expect(modulated.recoveryTimerMs).toBe(rules.recoveryTimerMs * rules.chronomancyFactor)
  })

  it('les divise en Chronomancie noire', () => {
    const modulated = rulesWithEffects(rules, chronomancy('curse'))

    expect(modulated.ascentTimerMs).toBe(rules.ascentTimerMs / rules.chronomancyFactor)
    expect(modulated.recoveryTimerMs).toBe(rules.recoveryTimerMs / rules.chronomancyFactor)
  })

  it('multiplie les Chronomancie entre elles', () => {
    expect(rulesWithEffects(rules, chronomancy('curse', 2)).ascentTimerMs)
      .toBe(rules.ascentTimerMs / (rules.chronomancyFactor ** 2))
  })

  it('compose les deux faces de Chronomancie plutôt que de les annuler d office', () => {
    const both = [...chronomancy('boon', 2), ...chronomancy('curse')]

    expect(rulesWithEffects(rules, both).ascentTimerMs)
      .toBe(rules.ascentTimerMs * rules.chronomancyFactor)
  })

  it('n amène jamais un timer à zéro, quel qu en soit l empilement', () => {
    expect(rulesWithEffects(rules, chronomancy('curse', 20)).ascentTimerMs).toBeGreaterThan(0)
  })

  it('ne touche à rien d autre que les deux timers', () => {
    const { ascentTimerMs: _a, recoveryTimerMs: _r, ...rest } = rulesWithEffects(rules, chronomancy('boon'))
    const { ascentTimerMs: _fa, recoveryTimerMs: _fr, ...floorRest } = rules

    expect(rest).toEqual(floorRest)
  })

  it('double les questions tirées au rattrapage en Indulgence blanche', () => {
    const effects: SpellEffect[] = [{ spell: 'INDULGENCE', face: 'boon' }]

    expect(rulesWithEffects(rules, effects).recoveryQuestions)
      .toBe(rules.recoveryQuestions * rules.indulgenceFactor)
  })

  // Le seuil qui autorise le rattrapage ne bouge pas : le relever ferait qu'une
  // Indulgence empêche le rattrapage qu'elle est censée rallonger.
  it('ne touche pas au seuil qui autorise le rattrapage', () => {
    const effects: SpellEffect[] = [{ spell: 'INDULGENCE', face: 'boon' }]
    const modulated = rulesWithEffects(rules, effects)

    expect(modulated.poolSizeForRecovery).toBe(rules.poolSizeForRecovery)
    expect(modulated.recoverySuccessesToResume).toBe(rules.recoverySuccessesToResume)
  })

  // La face noire d'Indulgence exige un perfect — elle ne raccourcit pas le
  // tirage. La compter comme l'inverse du blanc descendait sous le seuil du
  // rattrapage, qui se refusait alors d'ouvrir. Voir specs/bonus.md#cumul.
  it('ne raccourcit pas le tirage en Indulgence noire', () => {
    const effects: SpellEffect[] = [{ spell: 'INDULGENCE', face: 'curse' }]

    expect(rulesWithEffects(rules, effects).recoveryQuestions).toBe(rules.recoveryQuestions)
  })

  it('compte la blanche même quand une noire l accompagne', () => {
    const effects: SpellEffect[] = [
      { spell: 'INDULGENCE', face: 'boon' },
      { spell: 'INDULGENCE', face: 'curse' },
    ]

    expect(rulesWithEffects(rules, effects).recoveryQuestions)
      .toBe(rules.recoveryQuestions * rules.indulgenceFactor)
  })

  // Ce qu'elle fait à la place : exiger un perfect, c'est-à-dire autant de
  // bonnes réponses que de questions tirées. Voir specs/bonus.md#catalogue.
  it('exige un perfect au prochain rattrapage en Indulgence noire', () => {
    const effects: SpellEffect[] = [{ spell: 'INDULGENCE', face: 'curse' }]
    const modulated = rulesWithEffects(rules, effects)

    expect(modulated.recoverySuccessesToResume).toBe(modulated.recoveryQuestions)
  })

  it('n exige un perfect qu une fois : deux noires valent une', () => {
    const effects: SpellEffect[] = [
      { spell: 'INDULGENCE', face: 'curse' },
      { spell: 'INDULGENCE', face: 'curse' },
    ]
    const modulated = rulesWithEffects(rules, effects)

    expect(modulated.recoveryQuestions).toBe(rules.recoveryQuestions)
    expect(modulated.recoverySuccessesToResume).toBe(rules.recoveryQuestions)
  })

  // Les deux faces se composent : le sort de l'allié aggrave la situation
  // plutôt que de l'adoucir — deux fois plus de questions, toutes à réussir.
  // Voir specs/bonus.md#cumul.
  it('compose la blanche et la noire en un perfect plus long', () => {
    const effects: SpellEffect[] = [
      { spell: 'INDULGENCE', face: 'boon' },
      { spell: 'INDULGENCE', face: 'curse' },
    ]
    const modulated = rulesWithEffects(rules, effects)

    expect(modulated.recoveryQuestions).toBe(rules.recoveryQuestions * rules.indulgenceFactor)
    expect(modulated.recoverySuccessesToResume).toBe(modulated.recoveryQuestions)
  })

  // Deux effets négatifs au plus : c'est cette limite, et non un plancher, qui
  // garantit qu'une tentative démarre avec au moins une vie.
  // Voir specs/mecanique.md#ce-que-les-sorts-modifient.
  it('laisse au moins une vie à la tentative, au plafond d effets négatifs', () => {
    expect(rulesWithEffects(rules, vitality('curse', rules.maxCurses)).lives)
      .toBeGreaterThanOrEqual(1)
  })

  // Le plafond se tient au tirage, donc par une lecture : deux lanceurs
  // simultanés peuvent poser une malédiction de trop. Une tentative à zéro vie
  // ne se jouant pas, le plancher rattrape ce cas-là et lui seul.
  it('laisse une vie même à une malédiction de trop', () => {
    expect(rulesWithEffects(rules, vitality('curse', rules.lives + 2)).lives).toBe(1)
  })
})
