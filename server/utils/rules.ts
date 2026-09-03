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
}

const HOUR_MS = 60 * 60 * 1000

const DEFAULT_RULES: FloorRules = {
  lives: 3,
  ascentTimerMs: 20_000,
  recoveryTimerMs: 60_000,
  recoveryQuestions: 3,
  recoverySuccessesToResume: 1,
  poolSizeForRecovery: 3,
  poolSuccessesToLeave: 2,
  cooldownMs: 12 * HOUR_MS,
  cooldownAfterFailedRecoveryMs: 4 * HOUR_MS,
  latencyGraceMs: 1_000,
}

/**
 * Per-floor overrides. Empty on purpose: no floor diverges today, and making one
 * diverge means adding an entry here and changing nothing else.
 */
const FLOOR_OVERRIDES: Partial<Record<number, Partial<FloorRules>>> = {}

export function rulesForFloor(floor: number): FloorRules {
  return { ...DEFAULT_RULES, ...FLOOR_OVERRIDES[floor] }
}
