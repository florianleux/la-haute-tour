import type { SpellEffect, SpellId } from '../../shared/utils/spells'

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
  /**
   * Ce par quoi une Chronomancie multiplie les timers — ou les divise, en magie
   * noire. Multiplicatif comme Répit, et pour la même raison : aucun empilement
   * ne ramène un timer à zéro, donc aucun plancher n'est nécessaire.
   * Voir specs/bonus.md#cumul.
   */
  chronomancyFactor: number
  /**
   * Ce par quoi une Indulgence multiplie les questions tirées au rattrapage.
   * Borné de fait par la taille du Pool Échecs : on ne tire jamais plus de
   * questions distinctes qu'il n'en contient.
   *
   * Ne touche pas au seuil qui autorise le rattrapage — `poolSizeForRecovery`
   * reste ce qu'il est, sinon le sort empêcherait le rattrapage qu'il est censé
   * rallonger. Voir specs/bonus.md#catalogue.
   */
  indulgenceFactor: number
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
  chronomancyFactor: 2,
  indulgenceFactor: 2,
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
  const vitality = netOf(effects, 'VITALITY')
  const respite = netOf(effects, 'RESPITE')
  const chronomancy = netOf(effects, 'CHRONOMANCY')
  // Indulgence n'est pas symétrique : sa face noire exige un perfect, elle ne
  // raccourcit pas le tirage. Seules les blanches comptent ici ; la noire arrive
  // avec la magie noire. Voir specs/bonus.md#cumul.
  const indulgence = boonsOf(effects, 'INDULGENCE')

  return {
    ...rules,
    // Additive : le mode de cumul est propre à chaque sort.
    lives: rules.lives + vitality * rules.vitalityLives,
    // Multiplicatifs : diviser plutôt que soustraire est ce qui empêche une
    // attente ou un timer d'atteindre zéro, quel que soit l'empilement. Le blanc
    // raccourcit l'attente et rallonge les timers — d'où les sens opposés.
    cooldownMs: rules.cooldownMs / rules.respiteFactor ** respite,
    // Toute la tentative, ascension et rattrapage : Chronomancie ne porte pas
    // sur une question mais sur celles qu'ouvre la tentative où elle s'ancre.
    ascentTimerMs: rules.ascentTimerMs * rules.chronomancyFactor ** chronomancy,
    recoveryTimerMs: rules.recoveryTimerMs * rules.chronomancyFactor ** chronomancy,
    // Arrondi à l'entier : on tire des questions, pas des fractions. Le tirage
    // s'arrête de toute façon à ce que le pool contient.
    recoveryQuestions: Math.round(rules.recoveryQuestions * rules.indulgenceFactor ** indulgence),
  }
}

/**
 * Ce qu'un empilement d'un même sort pèse : une face blanche compte pour un, une
 * noire pour moins un. Les deux faces se composent — elles ne s'annulent pas
 * d'office, c'est l'arithmétique du sort qui décide de ce que ça donne.
 * Voir specs/bonus.md#cumul.
 */
function netOf(effects: SpellEffect[], spell: SpellId): number {
  return effects
    .filter(effect => effect.spell === spell)
    .reduce((net, { face }) => net + (face === 'boon' ? 1 : -1), 0)
}

/**
 * Les seules faces blanches d'un sort. Pour ceux dont les deux faces ne font pas
 * la même chose en sens inverse : compter une noire pour moins un leur ferait
 * produire un effet que la spec ne leur donne pas.
 * Voir specs/bonus.md#cumul.
 */
function boonsOf(effects: SpellEffect[], spell: SpellId): number {
  return effects.filter(effect => effect.spell === spell && effect.face === 'boon').length
}
