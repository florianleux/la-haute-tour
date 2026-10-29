import { describe, expect, it } from 'vitest'
import {
  BOSS_FIGHT_COUNT,
  bossFightOpening,
  bossFightState,
  bossOutcome,
  canDrawRecovery,
  drawByRank,
  isLootQuestion,
  judgeAnswer,
  judgeRecovery,
  judgeTrial,
  movePoolCounter,
  rollChest,
  keyDue,
  phaseOf,
  sealedRecovery,
} from '../../server/utils/mechanics'
import { SPELL_IDS } from '../../shared/utils/spells'
import { rulesForFloor } from '../../server/utils/rules'
import { rolls } from '../helpers/random'
import type { LootQuestionInput } from '../../server/utils/mechanics'

const NOW = new Date('2026-09-03T12:00:00.000Z')
const rules = rulesForFloor(1)

function player(overrides: Partial<{ lives: number, currentFloor: number, cooldownUntil: Date | null, bossHp: number | null }> = {}) {
  return { lives: 3, currentFloor: 1, cooldownUntil: null, bossHp: null, ...overrides }
}

describe('phase', () => {
  const ascent = { user: player(), hasLiveReservation: true, holdsVerdict: false, seen: 2, floorTotal: 10, nextFloorTotal: 10 }

  it('est l ascension tant qu il reste des vies et des questions', () => {
    expect(phaseOf(ascent, NOW)).toBe('ascent')
  })

  it('est l attente tant que son échéance n est pas atteinte', () => {
    const inCooldown = {
      ...ascent,
      user: player({ lives: 0, cooldownUntil: new Date(NOW.getTime() + 1_000) }),
    }

    expect(phaseOf(inCooldown, NOW)).toBe('cooldown')
  })

  it('devient rattrapage à l échéance, sans qu aucune tâche ne tourne', () => {
    const elapsed = {
      ...ascent,
      user: player({ lives: 0, cooldownUntil: new Date(NOW.getTime() - 1) }),
    }

    expect(phaseOf(elapsed, NOW)).toBe('recovery')
  })

  it('est le palier quand tout l étage est vu, au dernier étage aussi : le boss vient avant la fin', () => {
    const done = { user: player(), hasLiveReservation: false, holdsVerdict: true, seen: 10, floorTotal: 10, nextFloorTotal: 10 }

    expect(phaseOf(done, NOW)).toBe('floorEnd')
    expect(phaseOf({ ...done, user: player({ currentFloor: 6 }) }, NOW)).toBe('floorEnd')
  })

  // specs/boss.md#arriver-devant-la-porte : le verdict de la dernière question quitté.
  it('est la porte du boss une fois le verdict du palier quitté', () => {
    const door = { user: player(), hasLiveReservation: false, holdsVerdict: false, seen: 10, floorTotal: 10, nextFloorTotal: 10 }

    expect(phaseOf(door, NOW)).toBe('bossDoor')
    expect(phaseOf({ ...door, user: player({ currentFloor: 6 }) }, NOW)).toBe('bossDoor')
  })

  it('ne conclut pas l étage tant qu une question est en jeu', () => {
    const held = { user: player(), hasLiveReservation: true, holdsVerdict: false, seen: 10, floorTotal: 10, nextFloorTotal: 10 }

    expect(phaseOf(held, NOW)).toBe('ascent')
  })

  // specs/boss.md#cas-à-0-vie : l'étage fini sans vie mène au palier, sans attente.
  it('mène au palier puis à la porte quand l étage finit sans vie', () => {
    const done = { hasLiveReservation: false, seen: 10, floorTotal: 10, nextFloorTotal: 10 }

    expect(phaseOf({ ...done, holdsVerdict: true, user: player({ lives: 0 }) }, NOW)).toBe('floorEnd')
    expect(phaseOf({ ...done, holdsVerdict: false, user: player({ lives: 0 }) }, NOW)).toBe('bossDoor')
  })

  // specs/boss.md#tentatives-et-difficulté : la défaite attend au camp.
  it('fait attendre après une défaite au boss', () => {
    const done = { hasLiveReservation: false, holdsVerdict: false, seen: 10, floorTotal: 10, nextFloorTotal: 10 }

    expect(phaseOf({ ...done, user: player({ lives: 0, cooldownUntil: new Date(NOW.getTime() + 1_000) }) }, NOW)).toBe('cooldown')
    expect(phaseOf({ ...done, user: player({ lives: 0, cooldownUntil: new Date(NOW.getTime() - 1) }) }, NOW)).toBe('recovery')
  })

  it('est le combat tant que le boss a des PV, et le reste sur la victoire à lire', () => {
    const done = { hasLiveReservation: false, holdsVerdict: false, seen: 10, floorTotal: 10, nextFloorTotal: 10 }

    expect(phaseOf({ ...done, user: player({ bossHp: 7 }) }, NOW)).toBe('bossFight')
    expect(phaseOf({ ...done, user: player({ bossHp: 0 }) }, NOW)).toBe('bossFight')
  })

  it('finit la partie sur le boss du dernier étage battu', () => {
    const done = { hasLiveReservation: false, holdsVerdict: false, seen: 10, floorTotal: 10, nextFloorTotal: 0 }

    expect(phaseOf({ ...done, user: player({ currentFloor: 6, bossHp: 0 }) }, NOW)).toBe('gameOver')
    expect(phaseOf({ ...done, user: player({ currentFloor: 6, bossHp: 3 }) }, NOW)).toBe('bossFight')
  })

  it('est la fin du deck quand l étage d au-dessus est vide, vies ou pas', () => {
    const done = { user: player(), hasLiveReservation: false, holdsVerdict: false, seen: 10, floorTotal: 10, nextFloorTotal: 0 }

    expect(phaseOf(done, NOW)).toBe('deckEnd')
    expect(phaseOf({ ...done, user: player({ lives: 0, cooldownUntil: new Date(NOW.getTime() + 1_000) }) }, NOW)).toBe('deckEnd')
    expect(phaseOf({ ...done, hasLiveReservation: true }, NOW)).toBe('ascent')
    // Le dernier étage n'a jamais d'étage au-dessus : son boss passe quand même.
    expect(phaseOf({ ...done, user: player({ currentFloor: 6 }) }, NOW)).toBe('bossDoor')
  })
})

describe('combat de boss', () => {
  // specs/spec.md#glossaire (État du combat) : les cinq états, lus au même endroit.
  it('se lit en cinq états', () => {
    expect(bossFightState({ bossHp: null, lives: 3 }, false)).toBe('none')
    expect(bossFightState({ bossHp: 4, lives: 1 }, true)).toBe('running')
    expect(bossFightState({ bossHp: 0, lives: 2 }, true)).toBe('victory')
    expect(bossFightState({ bossHp: 0, lives: 0 }, true)).toBe('passed')
    // La défaite efface les PV mais garde les épreuves : c'est ce qui la distingue.
    expect(bossFightState({ bossHp: null, lives: 0 }, true)).toBe('defeat')
  })

  it('n a de terme qu une fois le combat fini', () => {
    expect(bossOutcome('none')).toBeNull()
    expect(bossOutcome('running')).toBeNull()
    expect(bossOutcome('passed')).toBe('passed')
  })

  it('s ouvre à PV pleins, un combat de plus, trois vies au plus', () => {
    expect(bossFightOpening({ lives: rules.lives + 1, bossAttemptNumber: 2 }, rules))
      .toEqual({ bossHp: rules.bossHp, bossAttemptNumber: 3, lives: rules.lives })
    expect(bossFightOpening({ lives: 1, bossAttemptNumber: 0 }, rules).lives).toBe(1)
  })

  // specs/boss.md#cas-à-0-vie : arrivé sans vie, il entre à vies pleines.
  it('s ouvre à vies pleines pour qui arrive sans vie', () => {
    expect(bossFightOpening({ lives: 0, bossAttemptNumber: 0 }, rules).lives).toBe(rules.lives)
  })

  describe('épreuve jugée', () => {
    const fighting = { bossHp: 5, lives: 2, bossAttemptNumber: 1 }

    it('juste, retire un PV au boss et rien au joueur', () => {
      expect(judgeTrial(fighting, true, rules, NOW)).toEqual({ bossHp: 4 })
    })

    it('fausse, retire une vie au joueur', () => {
      expect(judgeTrial(fighting, false, rules, NOW)).toEqual({ lives: 1 })
    })

    it('fausse sur la dernière vie, c est la défaite : PV effacés, attente ouverte', () => {
      const fields = judgeTrial({ ...fighting, lives: 1 }, false, rules, NOW)

      expect(fields).toMatchObject({ lives: 0, bossHp: null, cooldownStartedAt: NOW })
      expect(fields.cooldownUntil?.getTime()).toBe(NOW.getTime() + rules.cooldownMs)
    })

    it('fausse sur la dernière vie du dernier combat, le boss laisse passer', () => {
      const fields = judgeTrial({ ...fighting, lives: 1, bossAttemptNumber: BOSS_FIGHT_COUNT }, false, rules, NOW)

      expect(fields).toEqual({ lives: 0, bossHp: 0 })
      expect(bossFightState({ ...fighting, ...fields }, true)).toBe('passed')
    })
  })
})

describe('verdict d une réponse', () => {
  const ascentReservation = {
    mode: 'ascent' as const,
    expiresAt: new Date(NOW.getTime() + rules.ascentTimerMs),
  }

  const input = {
    user: player(),
    reservation: ascentReservation,
    source: 'player' as const,
    acceptedAnswers: ['Bordeaux'],
    answer: 'bordaux',
    lastOfFloor: false,
    rules,
  }

  it('accepte une faute de frappe sans rien coûter', () => {
    expect(judgeAnswer(input, NOW)).toMatchObject({
      correct: true,
      lifeLost: false,
      livesAfter: 3,
      seenDelta: 1,
      entersPool: false,
    })
  })

  it('coûte une vie et verse au Pool Échecs sur une mauvaise réponse', () => {
    expect(judgeAnswer({ ...input, answer: 'Toulouse' }, NOW)).toMatchObject({
      correct: false,
      lifeLost: true,
      livesAfter: 2,
      entersPool: true,
      cooldownUntil: null,
    })
  })

  it('démarre l attente quand la dernière vie tombe', () => {
    const verdict = judgeAnswer({ ...input, user: player({ lives: 1 }), answer: 'Toulouse' }, NOW)

    expect(verdict.livesAfter).toBe(0)
    expect(verdict.cooldownUntil).toEqual(new Date(NOW.getTime() + rules.cooldownMs))
  })

  // specs/boss.md#cas-à-0-vie : la dernière question de l'étage mène au palier.
  it('ne démarre pas l attente quand la dernière vie tombe sur la dernière question de l étage', () => {
    const verdict = judgeAnswer({ ...input, user: player({ lives: 1 }), answer: 'Toulouse', lastOfFloor: true }, NOW)

    expect(verdict).toMatchObject({ livesAfter: 0, lifeLost: true, entersPool: true, cooldownUntil: null })
  })

  it('traite en timeout une bonne réponse arrivée trop tard', () => {
    const late = new Date(NOW.getTime() + rules.ascentTimerMs + rules.latencyGraceMs + 1)

    expect(judgeAnswer({ ...input, answer: 'Bordeaux' }, late)).toMatchObject({
      expired: true,
      correct: false,
      lifeLost: true,
    })
  })

  it('accepte encore une réponse arrivée dans la marge de latence', () => {
    const barely = new Date(NOW.getTime() + rules.ascentTimerMs + rules.latencyGraceMs)

    expect(judgeAnswer({ ...input, answer: 'Bordeaux' }, barely)).toMatchObject({
      expired: false,
      correct: true,
    })
  })

  it('valide une bonne réponse déjà saisie quand le joueur quitte la page en ascension', () => {
    // La sanction est de perdre la main sur la question, pas la réponse.
    expect(judgeAnswer({ ...input, answer: 'Bordeaux', source: 'focusLoss' }, NOW)).toMatchObject({
      correct: true,
      lifeLost: false,
    })
  })

  it('compte faux un départ de page en rattrapage, quoi qu il y ait eu dans le champ', () => {
    const recovery = {
      ...input,
      answer: 'Bordeaux',
      source: 'focusLoss' as const,
      reservation: { mode: 'recovery' as const, expiresAt: ascentReservation.expiresAt },
    }

    // Aucune vie à prendre en rattrapage : la sanction est la question comptée
    // fausse, donc son compteur de réussites qui repart de zéro.
    expect(judgeAnswer(recovery, NOW)).toMatchObject({ correct: false, lifeLost: false })
  })

  it('ne coûte ni vie ni progression en rattrapage', () => {
    const recovery = {
      ...input,
      answer: 'Toulouse',
      reservation: { mode: 'recovery' as const, expiresAt: ascentReservation.expiresAt },
    }

    expect(judgeAnswer(recovery, NOW)).toMatchObject({
      correct: false,
      lifeLost: false,
      livesAfter: 3,
      seenDelta: 0,
      entersPool: false,
    })
  })
})

describe('compteur du Pool Échecs', () => {
  const entry = { poolSuccesses: 0, lastFailedAt: new Date(NOW.getTime() - 60_000) }

  it('monte d un cran sur une bonne réponse, sans toucher la date d échec', () => {
    expect(movePoolCounter(entry, true, rules, NOW)).toEqual({
      leaves: false,
      poolSuccesses: 1,
      lastFailedAt: entry.lastFailedAt,
    })
  })

  it('fait sortir la question au seuil atteint', () => {
    const nearly = { ...entry, poolSuccesses: rules.poolSuccessesToLeave - 1 }

    expect(movePoolCounter(nearly, true, rules, NOW)).toEqual({ leaves: true })
  })

  it('remet à zéro et remonte la date d échec sur une mauvaise réponse', () => {
    const nearly = { ...entry, poolSuccesses: 1 }

    expect(movePoolCounter(nearly, false, rules, NOW)).toEqual({
      leaves: false,
      poolSuccesses: 0,
      lastFailedAt: NOW,
    })
  })
})

describe('tirage d un rattrapage', () => {
  it('exige un pool au moins aussi fourni que les deux seuils', () => {
    const enough = Math.max(rules.poolSizeForRecovery, rules.recoveryQuestions)

    expect(canDrawRecovery(enough, rules)).toBe(true)
    expect(canDrawRecovery(enough - 1, rules)).toBe(false)
  })
})

describe('verdict d un rattrapage', () => {
  it('rend les vies dès une bonne réponse', () => {
    expect(judgeRecovery(1, rules.recoveryQuestions, rules, NOW)).toEqual({
      resumes: true,
      livesAfter: rules.lives,
      cooldownUntil: null,
    })
  })

  it('relance une attente plus courte quand rien n a été juste', () => {
    expect(judgeRecovery(0, rules.recoveryQuestions, rules, NOW)).toEqual({
      resumes: false,
      livesAfter: 0,
      cooldownUntil: new Date(NOW.getTime() + rules.cooldownAfterFailedRecoveryMs),
    })
  })
})

describe('verdict scellé', () => {
  const total = 3
  const threshold = rules.recoverySuccessesToResume

  it('est scellé dès que le quota de bonnes réponses est atteint', () => {
    expect(sealedRecovery(threshold, 1, total, rules)).toBe(true)
    expect(sealedRecovery(threshold, 2, total, rules)).toBe(true)
  })

  it('est scellé quand le quota est mathématiquement impossible', () => {
    // Seuil = 1 : scellé seulement quand tout est joué sans aucune juste.
    expect(sealedRecovery(0, total, total, rules)).toBe(true)
    // Seuil = 3 (perfectRequired) : 1 juste, 1 reste, 1 + 1 < 3 → scellé.
    const perfect = { ...rules, recoverySuccessesToResume: 3 }
    expect(sealedRecovery(1, 2, 3, perfect)).toBe(true)
    // 1 juste, 2 restent, 1 + 2 = 3 ≥ 3 → encore possible → pas scellé.
    expect(sealedRecovery(1, 1, 3, perfect)).toBe(false)
  })

  it('n est pas scellé tant que le quota reste atteignable', () => {
    expect(sealedRecovery(0, 1, total, rules)).toBe(false)
    expect(sealedRecovery(0, 2, total, rules)).toBe(false)
  })
})

describe('question loot', () => {
  const step = rules.questionsPerChest
  const floorTotal = 10 * step

  const at = (position: number, overrides: Partial<LootQuestionInput> = {}) =>
    isLootQuestion({ position, floorTotal, mode: 'ascent', ...overrides }, rules)

  it('marque la question qui tombe sur le seuil, et elle seule', () => {
    expect(at(step)).toBe(true)
    expect(at(2 * step)).toBe(true)
    expect(at(step - 1)).toBe(false)
    expect(at(step + 1)).toBe(false)
  })

  it('ne marque jamais la première question de l étage', () => {
    expect(at(1)).toBe(false)
  })

  it('épargne la dernière question restante de l étage, seuil ou non', () => {
    expect(at(step, { floorTotal: step })).toBe(false)
  })

  it('ignore le rattrapage : ses questions sont déjà vues', () => {
    expect(at(step, { mode: 'recovery' })).toBe(false)
  })
})

// Voir specs/boss.md#obtention-de-la-clé.
describe('clé due par le coffre', () => {
  it('est due à partir de la moitié de l étage parcouru', () => {
    expect(keyDue({ floorSeen: 50, floorTotal: 100, hasKey: false })).toBe(true)
    expect(keyDue({ floorSeen: 51, floorTotal: 101, hasKey: false })).toBe(true)
  })

  it('n est pas due avant la moitié', () => {
    expect(keyDue({ floorSeen: 49, floorTotal: 100, hasKey: false })).toBe(false)
    expect(keyDue({ floorSeen: 50, floorTotal: 101, hasKey: false })).toBe(false)
  })

  it('n est plus due une fois la clé obtenue', () => {
    expect(keyDue({ floorSeen: 80, floorTotal: 100, hasKey: true })).toBe(false)
  })
})

describe('contenu d un coffre', () => {
  it('rend un Mimic sous le taux', () => {
    const roll = rules.mimicChance - 0.001

    expect(rollChest(rules, rolls(roll), 'spell', true)).toEqual({ mimic: true, spell: null })
  })

  it('épargne le premier coffre et celui qui suit un Mimic', () => {
    expect(rollChest(rules, rolls(0, 0), null, true)).toEqual({ mimic: false, spell: SPELL_IDS[0] })
    expect(rollChest(rules, rolls(0, 0), 'mimic', true)).toEqual({ mimic: false, spell: SPELL_IDS[0] })
  })

  it('rend un sort au taux pile', () => {
    expect(rollChest(rules, rolls(rules.mimicChance, 0), 'spell', true)).toEqual({
      mimic: false,
      spell: SPELL_IDS[0],
    })
  })

  // Voir specs/bonus.md#coffre-et-mimic : la leçon du Grimoire apprend à le lancer.
  it('donne Vitalité tant qu aucun sort n est découvert, quel que soit le tirage', () => {
    expect(rollChest(rules, rolls(0, 0.999), null, false)).toEqual({ mimic: false, spell: 'VITALITY' })
    expect(rollChest(rules, rolls(0.999, 0.5), null, false)).toEqual({ mimic: false, spell: 'VITALITY' })
  })

  it('tire dans tout le catalogue, jusqu au dernier', () => {
    expect(rollChest(rules, rolls(0.5, 0.999), 'spell', true)).toEqual({
      mimic: false,
      spell: SPELL_IDS[SPELL_IDS.length - 1],
    })
  })
})

// Une seule fonction, lue dans les deux sens : on tape le plus fort, on soutient
// le plus faible. Voir specs/bonus.md#tirage-de-la-cible.
describe('tirage pondéré par le rang', () => {
  // Classés par progression croissante : le premier est le moins avancé.
  const ranked = ['bas', 'moyen', 'haut', 'tête']

  it('donne au moins avancé le plus gros poids en allié', () => {
    // Quatre cibles, poids 4/3/2/1 sur 10 : le premier tient les 40 % du bas.
    expect(drawByRank(ranked, 'ally', rolls(0))).toBe('bas')
    expect(drawByRank(ranked, 'ally', rolls(0.399))).toBe('bas')
    expect(drawByRank(ranked, 'ally', rolls(0.401))).toBe('moyen')
    expect(drawByRank(ranked, 'ally', rolls(0.999))).toBe('tête')
  })

  it('renverse la pondération en ennemi', () => {
    // Poids 1/2/3/4 : le mieux classé tient les 40 % du haut.
    expect(drawByRank(ranked, 'foe', rolls(0))).toBe('bas')
    expect(drawByRank(ranked, 'foe', rolls(0.101))).toBe('moyen')
    expect(drawByRank(ranked, 'foe', rolls(0.5))).toBe('haut')
    expect(drawByRank(ranked, 'foe', rolls(0.999))).toBe('tête')
  })

  it('rend la seule cible du pool, quel que soit le tirage', () => {
    expect(drawByRank(['seul'], 'ally', rolls(0.999))).toBe('seul')
  })

  // Pool vide : le sort part et ne fait rien, comme Purge sur un pool vide.
  it('ne rend personne sur un pool vide', () => {
    expect(drawByRank([], 'ally', rolls(0.5))).toBeNull()
  })
})
