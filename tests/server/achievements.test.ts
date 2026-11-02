import { describe, expect, it } from 'vitest'
import { dayKey, earnedByAnswer, earnedByCrossing, earnedByFloorDone, earnedByResuming, earnedByTrial, gameHour, playedToday } from '../../server/utils/achievements'
import { DAY_TIERS, STREAK_TIERS, VIEW_MILESTONES } from '../../shared/utils/achievements'
import { FLOOR_COUNT } from '../../shared/utils/floors'
import type { AnsweredInput } from '../../server/utils/achievements'

/**
 * Les seuils ne sont jamais écrits en dur ici : ils se lisent dans le catalogue,
 * sans quoi ces tests diraient « 50 » alors que le catalogue dirait autre chose.
 */
const [FIRST_TIER, SECOND_TIER] = STREAK_TIERS
const LAST_TIER = STREAK_TIERS[STREAK_TIERS.length - 1]

function answered(overrides: Partial<AnsweredInput> = {}): AnsweredInput {
  return {
    correct: true,
    empty: false,
    died: false,
    streak: 0,
    seenTotal: 0,
    playStreak: 0,
    focusLoss: false,
    answeredInMs: 10_000,
    remainingMs: 10_000,
    hour: 12,
    ...overrides,
  }
}

describe('ce qu une réponse prouve', () => {
  it('distingue la bonne réponse de la mauvaise', () => {
    expect(earnedByAnswer(answered({ correct: true }))).toContain('FIRST_CORRECT')
    expect(earnedByAnswer(answered({ correct: true }))).not.toContain('FIRST_WRONG')

    expect(earnedByAnswer(answered({ correct: false }))).toContain('FIRST_WRONG')
    expect(earnedByAnswer(answered({ correct: false }))).not.toContain('FIRST_CORRECT')
  })

  // Le système ne distingue pas la cause : délai écoulé, perte de focus ou champ
  // soumis vide sont la même chose. Voir specs/succes.md#réponse-vide.
  it('compte la réponse vide, quelle qu en soit la cause', () => {
    expect(earnedByAnswer(answered({ correct: false, empty: true }))).toContain('EMPTY_ANSWER')
    expect(earnedByAnswer(answered({ correct: false, empty: false }))).not.toContain('EMPTY_ANSWER')
  })

  it('compte la mort à la dernière vie tombée', () => {
    expect(earnedByAnswer(answered({ correct: false, died: true }))).toContain('FIRST_DEATH')
    expect(earnedByAnswer(answered({ correct: false, died: false }))).not.toContain('FIRST_DEATH')
  })

  /**
   * Des seuils, pas des franchissements : l attribution n est pas dans le même lot
   * que le fait qui la déclenche, et un seuil rattrape au coup suivant là où une
   * égalité perdrait le succès pour toujours. C est l appelant qui écarte ce que
   * le joueur possède déjà.
   */
  it('rend tous les paliers de série atteints, pas seulement le dernier', () => {
    const earned = earnedByAnswer(answered({ streak: SECOND_TIER }))

    expect(earned).toContain(`STREAK_${FIRST_TIER}`)
    expect(earned).toContain(`STREAK_${SECOND_TIER}`)
    expect(earned).not.toContain(`STREAK_${LAST_TIER}`)
  })

  it('ne rend aucun palier sous le premier seuil', () => {
    const earned = earnedByAnswer(answered({ streak: FIRST_TIER - 1 }))

    expect(earned.filter(id => id.startsWith('STREAK_'))).toEqual([])
  })

  it('rend chaque palier pour la série qui l atteint exactement', () => {
    for (const tier of STREAK_TIERS) {
      expect(earnedByAnswer(answered({ streak: tier }))).toContain(`STREAK_${tier}`)
    }
  })

  it('compte les positions notables sur les vues de toujours', () => {
    const [first] = VIEW_MILESTONES

    expect(earnedByAnswer(answered({ seenTotal: first }))).toContain(`QUESTION_${first}`)
    expect(earnedByAnswer(answered({ seenTotal: first - 1 }))).not.toContain(`QUESTION_${first}`)
  })

  it('compte les paliers de jours qui se suivent', () => {
    const [first] = DAY_TIERS

    expect(earnedByAnswer(answered({ playStreak: first }))).toContain(`DAYS_${first}`)
    expect(earnedByAnswer(answered({ playStreak: first - 1 }))).not.toContain(`DAYS_${first}`)
  })

  it('compte deux jours qui se suivent', () => {
    expect(earnedByAnswer(answered({ playStreak: 2 }))).toContain('TWO_DAYS_IN_A_ROW')
    expect(earnedByAnswer(answered({ playStreak: 1 }))).not.toContain('TWO_DAYS_IN_A_ROW')
  })

  it('compte la réponse juste en moins de 3 secondes', () => {
    expect(earnedByAnswer(answered({ answeredInMs: 2_999 }))).toContain('QUICK_ANSWER')
    expect(earnedByAnswer(answered({ answeredInMs: 3_000 }))).not.toContain('QUICK_ANSWER')
    expect(earnedByAnswer(answered({ answeredInMs: 1_000, correct: false }))).not.toContain('QUICK_ANSWER')
  })

  it('compte la réponse juste dans la dernière seconde, délai de grâce compris', () => {
    expect(earnedByAnswer(answered({ remainingMs: 1_000 }))).toContain('LAST_SECOND')
    expect(earnedByAnswer(answered({ remainingMs: -200 }))).toContain('LAST_SECOND')
    expect(earnedByAnswer(answered({ remainingMs: 1_001 }))).not.toContain('LAST_SECOND')
    expect(earnedByAnswer(answered({ remainingMs: 0, correct: false }))).not.toContain('LAST_SECOND')
  })

  it('compte la perte de focus', () => {
    expect(earnedByAnswer(answered({ focusLoss: true }))).toContain('FOCUS_LOST')
    expect(earnedByAnswer(answered())).not.toContain('FOCUS_LOST')
  })

  it('compte la réponse entre 3 h et 5 h', () => {
    expect(earnedByAnswer(answered({ hour: 3 }))).toContain('NIGHT_OWL')
    expect(earnedByAnswer(answered({ hour: 4 }))).toContain('NIGHT_OWL')
    expect(earnedByAnswer(answered({ hour: 2 }))).not.toContain('NIGHT_OWL')
    expect(earnedByAnswer(answered({ hour: 5 }))).not.toContain('NIGHT_OWL')
  })

  it('ne rend jamais deux fois le même succès', () => {
    const earned = earnedByAnswer(answered({
      correct: true,
      streak: LAST_TIER,
      seenTotal: VIEW_MILESTONES[VIEW_MILESTONES.length - 1],
      playStreak: DAY_TIERS[DAY_TIERS.length - 1],
    }))

    expect(new Set(earned).size).toBe(earned.length)
  })
})

describe('ce qu un étage achevé prouve', () => {
  const floorTotal = 166

  it('donne le sans-faute quand la série couvre l étage entier', () => {
    expect(earnedByFloorDone({ floor: 1, floorTotal, streak: floorTotal }))
      .toContain('FLAWLESS_FLOOR_1')
  })

  // Le streak est remis à zéro par toute vie perdue et par toute tentative neuve :
  // rester sous la taille de l étage au palier, c est avoir été coupé quelque part.
  it('refuse le sans-faute dès que la série est plus courte que l étage', () => {
    expect(earnedByFloorDone({ floor: 1, floorTotal, streak: floorTotal - 1 }))
      .not.toContain('FLAWLESS_FLOOR_1')
  })

  it('accepte une série plus longue que l étage, venue de l étage d en dessous', () => {
    expect(earnedByFloorDone({ floor: 2, floorTotal, streak: floorTotal * 3 }))
      .toContain('FLAWLESS_FLOOR_2')
  })

  // Un étage vide ne se réussit pas : sans cette garde, n importe quelle série le
  // couvrirait, y compris une série nulle.
  it('ne donne aucun sans-faute sur un étage sans question', () => {
    expect(earnedByFloorDone({ floor: 1, floorTotal: 0, streak: 0 }))
      .not.toContain('FLAWLESS_FLOOR_1')
  })

  /**
   * L achèvement ne récompense pas la montée : au dernier étage il n y a aucun
   * palier à franchir, et c est pourtant là que la fin du jeu se gagne.
   */
  it('ne donne aucun étage atteint : ce n est pas la montée qu il récompense', () => {
    expect(earnedByFloorDone({ floor: 1, floorTotal, streak: 0 })).toEqual([])
  })

  it('donne la fin du jeu au dernier étage, avec son sans-faute', () => {
    const earned = earnedByFloorDone({ floor: FLOOR_COUNT, floorTotal, streak: floorTotal })

    expect(earned).toContain('GAME_COMPLETED')
    expect(earned).toContain(`FLAWLESS_FLOOR_${FLOOR_COUNT}`)
  })

  it('ne donne pas la fin du jeu avant le dernier étage', () => {
    expect(earnedByFloorDone({ floor: FLOOR_COUNT - 1, floorTotal, streak: 0 }))
      .not.toContain('GAME_COMPLETED')
  })
})

describe('ce que franchir le palier donne', () => {
  it('donne l étage qu on rejoint', () => {
    expect(earnedByCrossing(1)).toEqual(['REACHED_FLOOR_2'])
  })

  // On n atteint pas le septième étage : il n existe pas, et la tour se termine
  // sur le sixième sans qu aucun palier ne se franchisse.
  it('ne donne rien au-delà du dernier étage', () => {
    expect(earnedByCrossing(FLOOR_COUNT)).toEqual([])
  })
})

describe('le jour joué', () => {
  // Le fuseau est celui des écrans, et pour la même raison : deux côtés qui
  // découpent les jours différemment ne parlent pas du même jour. Voir utils/date.ts.
  it('date au fuseau du jeu, pas à UTC', () => {
    expect(dayKey(new Date('2026-09-11T22:30:00.000Z'))).toBe('2026-09-12')
    expect(dayKey(new Date('2026-01-11T23:30:00.000Z'))).toBe('2026-01-12')
  })

  const NOW = new Date('2026-09-11T12:00:00.000Z')

  it('ne rend rien quand le joueur a déjà joué aujourd hui', () => {
    expect(playedToday({ lastPlayedDay: '2026-09-11', daysPlayed: 4, playStreak: 2 }, NOW)).toBeNull()
  })

  it('ouvre le compte au tout premier jour', () => {
    expect(playedToday({ lastPlayedDay: null, daysPlayed: 0, playStreak: 0 }, NOW))
      .toEqual({ lastPlayedDay: '2026-09-11', daysPlayed: 1, playStreak: 1 })
  })

  it('allonge la série quand la veille a été jouée', () => {
    expect(playedToday({ lastPlayedDay: '2026-09-10', daysPlayed: 4, playStreak: 2 }, NOW))
      .toEqual({ lastPlayedDay: '2026-09-11', daysPlayed: 5, playStreak: 3 })
  })

  it('repart à un jour dès qu un jour a été sauté', () => {
    expect(playedToday({ lastPlayedDay: '2026-09-09', daysPlayed: 4, playStreak: 2 }, NOW))
      .toEqual({ lastPlayedDay: '2026-09-11', daysPlayed: 5, playStreak: 1 })
  })

  // Les jours se comparent en dates, jamais en millisecondes : un changement
  // d heure fait des journées de 23 et de 25 heures, et « hier » doit rester hier.
  it('tient le changement d heure', () => {
    const afterDst = new Date('2026-10-25T12:00:00.000Z')

    expect(playedToday({ lastPlayedDay: '2026-10-24', daysPlayed: 1, playStreak: 1 }, afterDst))
      .toEqual({ lastPlayedDay: '2026-10-25', daysPlayed: 2, playStreak: 2 })
  })
})

describe('ce qu une épreuve de boss prouve', () => {
  const trial = (overrides: Partial<Parameters<typeof earnedByTrial>[0]> = {}): Parameters<typeof earnedByTrial>[0] => ({
    outcome: 'victory',
    position: 6,
    bossHp: 7,
    bossAttemptNumber: 1,
    ...overrides,
  })

  it('lit le sans-faute dans la place de l épreuve qui achève le boss', () => {
    expect(earnedByTrial(trial())).toEqual(['BOSS_BEATEN', 'BOSS_PERFECT', 'BOSS_FIRST_TRY'])
    expect(earnedByTrial(trial({ position: 7, bossAttemptNumber: 2 }))).toEqual(['BOSS_BEATEN'])
  })

  it('distingue le passage de la victoire', () => {
    expect(earnedByTrial(trial({ outcome: 'passed' }))).toEqual(['BOSS_PASSED'])
  })

  it('ne rend rien tant que le combat dure, ni à la défaite', () => {
    expect(earnedByTrial(trial({ outcome: null }))).toEqual([])
    expect(earnedByTrial(trial({ outcome: 'defeat' }))).toEqual([])
  })
})

describe('reprendre après l attente', () => {
  const until = new Date('2026-09-11T10:00:00.000Z')

  it('est ponctuel dans les 5 minutes, pas avant l échéance ni après', () => {
    expect(earnedByResuming(until, new Date('2026-09-11T10:05:00.000Z'))).toEqual(['PUNCTUAL'])
    expect(earnedByResuming(until, new Date('2026-09-11T10:05:01.000Z'))).toEqual([])
    expect(earnedByResuming(until, new Date('2026-09-11T09:59:59.000Z'))).toEqual([])
    expect(earnedByResuming(null, until)).toEqual([])
  })
})

describe('l heure du jeu', () => {
  it('se lit à Paris, heure d été comme d hiver', () => {
    expect(gameHour(new Date('2026-07-01T01:30:00.000Z'))).toBe(3)
    expect(gameHour(new Date('2026-12-01T02:30:00.000Z'))).toBe(3)
    expect(gameHour(new Date('2026-12-01T23:30:00.000Z'))).toBe(0)
  })
})
