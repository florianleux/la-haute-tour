import type { SpellEffect } from '../../shared/utils/spells'

/**
 * The one rule set of the game. No number of the game lives anywhere else: a
 * caller asks for the rules of a floor, never for an isolated constant.
 * See specs/mecanique.md#règles-chiffrées.
 */
export interface FloorRules {
  /** Lives granted per attempt. */
  lives: number
  /** How long a player has to answer an ascent question. */
  ascentTimerMs: number
  /** How long a player has to answer a recovery question. */
  recoveryTimerMs: number
  /** Questions drawn from the missed pool for one recovery. */
  recoveryQuestions: number
  /** Right answers needed during recovery to get the lives back. */
  recoverySuccessesToResume: number
  /** Below this pool size, cooldown ends in a plain resume, no recovery. */
  poolSizeForRecovery: number
  /** Consecutive recovery successes that take a question out of the pool. */
  poolSuccessesToLeave: number
  /** Wait after the last life is lost. */
  cooldownMs: number
  /** Shorter wait after a recovery where nothing was answered right. */
  cooldownAfterFailedRecoveryMs: number
  /**
   * How late an answer may arrive and still count. The deadline is the server's,
   * but the trip back is the network's. See specs/anti-triche.md#timer.
   */
  latencyGraceMs: number
  /**
   * Combien de temps le joueur peut quitter la page sans conséquence, pendant
   * qu'un timer tourne. Un alt-tab rattrapé n'est pas de la triche.
   * Voir specs/anti-triche.md#perte-de-focus.
   */
  focusGraceMs: number
  /**
   * Questions résolues entre deux coffres. La 50e question résolue de l'étage
   * en ouvre un si elle est juste — le statut se dérive de ce décompte, rien
   * n'est stocké. Voir specs/bonus.md#question-loot.
   */
  questionsPerChest: number
  /**
   * La part des coffres qui sont des Mimics. Aucun objet, et toutes les vies de
   * la tentative retirées d'un coup. Voir specs/bonus.md#coffre-et-mimic.
   */
  mimicChance: number
  /**
   * Les vies qu'une Vitalité ajoute — ou retire, en magie noire. Un facteur
   * appliqué aux vies de la tentative, pas une valeur qui les remplace.
   * Voir specs/mecanique.md#ce-que-les-sorts-modifient.
   */
  vitalityLives: number
  /**
   * Ce par quoi un Répit divise l'attente — ou la multiplie, en magie noire.
   * Multiplicatif et non soustractif : deux Répit blancs divisent par quatre,
   * jamais jusqu'à zéro, quel que soit ce qu'on empilera plus tard. C'est ce
   * qui garantit que la mécanique centrale du jeu reste debout.
   * Voir specs/bonus.md#cumul.
   */
  respiteFactor: number
}

const HOUR_MS = 60 * 60 * 1000

const DEFAULT_RULES: FloorRules = {
  lives: 3,
  ascentTimerMs: 60_000,
  recoveryTimerMs: 60_000,
  recoveryQuestions: 3,
  recoverySuccessesToResume: 1,
  poolSizeForRecovery: 3,
  poolSuccessesToLeave: 2,
  cooldownMs: 12 * HOUR_MS,
  cooldownAfterFailedRecoveryMs: 4 * HOUR_MS,
  latencyGraceMs: 1_000,
  focusGraceMs: 1_000,
  questionsPerChest: 50,
  mimicChance: 0.05,
  vitalityLives: 1,
  respiteFactor: 2,
}

/**
 * Per-floor overrides. Empty on purpose: no floor diverges today, and making one
 * diverge means adding an entry here and changing nothing else.
 */
const FLOOR_OVERRIDES: Partial<Record<number, Partial<FloorRules>>> = {}

export function rulesForFloor(floor: number): FloorRules {
  return { ...DEFAULT_RULES, ...FLOOR_OVERRIDES[floor] }
}

/**
 * Les règles telles qu'un joueur les joue : celles de son étage, modulées par
 * les effets posés sur lui. Un effet ne remplace jamais une règle — il l'écarte
 * de ce que le jeu de règles dit, du facteur que ce même jeu de règles porte.
 * C'est ici que la lecture cesse de dépendre du seul étage.
 *
 * Les deux faces se composent plutôt qu'elles ne s'annulent : deux blanches et
 * une noire valent une vie de plus, pas deux qui se neutralisent puis une.
 * Voir specs/mecanique.md#ce-que-les-sorts-modifient et specs/bonus.md#cumul.
 */
export function rulesWithEffects(rules: FloorRules, effects: SpellEffect[]): FloorRules {
  const vitality = effects.filter(effect => effect.spell === 'VITALITY')
  const respite = effects.filter(effect => effect.spell === 'RESPITE')

  return {
    ...rules,
    lives: vitality.reduce(
      (lives, { face }) => lives + (face === 'boon' ? rules.vitalityLives : -rules.vitalityLives),
      rules.lives,
    ),
    // Multiplicatif, là où Vitalité est additive : le mode de cumul est propre à
    // chaque sort. Diviser plutôt que soustraire est ce qui empêche l'attente
    // d'atteindre zéro, quel que soit l'empilement.
    cooldownMs: respite.reduce(
      (ms, { face }) => (face === 'boon' ? ms / rules.respiteFactor : ms * rules.respiteFactor),
      rules.cooldownMs,
    ),
  }
}
