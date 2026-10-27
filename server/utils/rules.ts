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
  /** Cooldown after the last life is lost. */
  cooldownMs: number
  /** Shorter cooldown after a failed recovery — quota out of reach, whatever was answered right. */
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
   * Questions résolues entre deux coffres. La 25e question résolue de l'étage
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
  /**
   * Combien d'effets négatifs un joueur porte au plus. Au-delà, il sort du
   * tirage des ennemis — silencieusement, le ciblage étant déjà aléatoire.
   *
   * C'est cette limite, et non un plancher sur les vies, qui garantit qu'une
   * tentative démarre toujours avec au moins une vie : deux Vitalité noires au
   * plus, sur trois vies. Voir specs/bonus.md#limite-deffets-négatifs.
   */
  maxCurses: number
  /**
   * Combien d'effets positifs un joueur porte au plus. Au-delà, il sort du
   * tirage des alliés, silencieusement, et ne peut plus se lancer de sort à
   * lui-même. C'est la seule borne des magies blanches : aucun budget de
   * lancers ne retient plus un joueur qui a fait des réserves, et sans elle
   * Répit, Chronomancie ou Vitalité s'empileraient sans fin.
   * Voir specs/bonus.md#limite-deffets-positifs.
   */
  maxBoons: number
  /**
   * Les PV du boss au début d'un combat. Une épreuve juste en retire un ; à zéro,
   * le boss est battu. Voir specs/boss.md#cadre-général.
   */
  bossHp: number
  /**
   * Le chrono d'une épreuve de boss. Propre au boss dans la spec ; le seul boss
   * qui existe le fixe à 30 s, et un autre le surchargera par étage, comme
   * n'importe quelle règle. Voir specs/boss-etage1-drapeaux.md.
   */
  bossTrialTimerMs: number
  /**
   * Les épreuves tirées pour un combat : de quoi trancher à coup sûr, 7 PV et
   * 3 vies se décidant en 9 au plus. Voir specs/boss.md#cadre-général.
   */
  bossTrialsPerFight: number
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
  questionsPerChest: 25,
  mimicChance: 0.05,
  vitalityLives: 1,
  respiteFactor: 2,
  chronomancyFactor: 2,
  indulgenceFactor: 2,
  maxCurses: 2,
  maxBoons: 2,
  bossHp: 7,
  bossTrialTimerMs: 30_000,
  bossTrialsPerFight: 10,
}

/**
 * Per-floor overrides. Empty on purpose: no floor diverges today, and making one
 * diverge means adding an entry here and changing nothing else.
 */
const FLOOR_OVERRIDES: Partial<Record<number, Partial<FloorRules>>> = {}

export function rulesForFloor(floor: number): FloorRules {
  return { ...DEFAULT_RULES, ...FLOOR_OVERRIDES[floor] }
}
