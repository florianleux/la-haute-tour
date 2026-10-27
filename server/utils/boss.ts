import { and, asc, eq, exists, isNull, sql } from 'drizzle-orm'
import { isAnswerAccepted } from '../../shared/utils/answers'
import { closeAttempt } from './journey'
import { cooldownFields, cooldownFrom, isExpired } from './mechanics'
import { bossTrials, flags, users } from '../db/schema'
import type { FloorRules } from './rules'
import type { Database } from '../db/client'
import type { BossTrial, Flag, User } from '../db/schema'

/**
 * Le combat de boss : ses épreuves, tirées à l'ouverture et servies une à une,
 * et ce qu'une réponse y coûte. Le reste — vies, attente, rattrapage — est celui
 * de l'ascension : un combat est une tentative de plus (ADR 0006).
 * Voir specs/boss.md.
 */

/** Une épreuve du combat, avec le drapeau qu'elle sert. */
export type HeldTrial = BossTrial & Pick<Flag, 'image' | 'answerLabel' | 'acceptedAnswers'>

/** L'épreuve servie, telle que l'écran la montre : l'image et le chrono, jamais ce qui la valide. */
export interface BossTrialView {
  image: string
  /** ISO 8601, fixé au service. Le décompte du client ne fait que le rendre. */
  expiresAt: string
  focusGraceMs: number
}

/** L'épreuve qui vient d'être jugée : la réponse ne se montre qu'après le verdict. */
export interface BossVerdict {
  image: string
  correct: boolean
  answerLabel: string
  submittedAnswer: string
}

/** Le terme d'un combat : le boss à 0 PV, ou le joueur à 0 vie. */
export type BossOutcome = 'victory' | 'defeat'

export interface BossView {
  hp: number
  maxHp: number
  /** L'épreuve en cours, null entre deux épreuves et au terme du combat. */
  trial: BossTrialView | null
  /** La dernière épreuve jugée, null avant la première. */
  verdict: BossVerdict | null
  /** Le terme du combat, null tant qu'il dure. */
  outcome: BossOutcome | null
}

/**
 * Les drapeaux d'un combat. ponytail: toujours ceux du premier ; les paliers de
 * difficulté (#35) liront `bossAttemptNumber`. Et Julien à tous les étages, tant
 * que les autres boss n'existent pas.
 */
const FIGHT_FLAGS = eq(flags.bossAttemptNumber, 1)

/**
 * Les épreuves du joueur et leurs drapeaux, rangées dans l'ordre du service.
 * Rendue plutôt qu'exécutée : elle part dans le lot de l'instantané. Vide hors
 * combat de boss, et c'est le cas presque toujours.
 */
function buildTrialsQuery(db: Database, userId: number) {
  return db
    .select({
      trial: bossTrials,
      image: flags.image,
      answerLabel: flags.answerLabel,
      acceptedAnswers: flags.acceptedAnswers,
    })
    .from(bossTrials)
    .innerJoin(flags, eq(flags.slug, bossTrials.flagSlug))
    .where(eq(bossTrials.userId, userId))
    .orderBy(asc(bossTrials.position))
}

type TrialsQuery = ReturnType<typeof buildTrialsQuery>

export function trialsQuery(db: Database, userId: number): TrialsQuery {
  return buildTrialsQuery(db, userId)
}

export function toHeldTrials(rows: Awaited<TrialsQuery>): HeldTrial[] {
  return rows.map(({ trial, ...flag }) => ({ ...trial, ...flag }))
}

/** L'épreuve servie et pas encore jugée : son chrono court. */
export function servedTrial(trials: HeldTrial[]): HeldTrial | undefined {
  return trials.find(trial => trial.expiresAt !== null && trial.resolvedAt === null)
}

/** Le combat tel que l'écran le montre. Null hors combat : aucune épreuve tirée. */
export function bossView(user: User, trials: HeldTrial[], rules: FloorRules): BossView | null {
  if (!trials.length) {
    return null
  }

  const served = servedTrial(trials)
  const judged = trials.filter(trial => trial.resolvedAt !== null).at(-1)

  return {
    // La défaite efface les PV du joueur : ils se relisent dans les épreuves.
    hp: user.bossHp ?? rules.bossHp - trials.filter(trial => trial.correct).length,
    maxHp: rules.bossHp,
    trial: served?.expiresAt
      ? { image: served.image, expiresAt: served.expiresAt.toISOString(), focusGraceMs: rules.focusGraceMs }
      : null,
    verdict: judged
      ? {
          image: judged.image,
          correct: judged.correct ?? false,
          answerLabel: judged.answerLabel,
          submittedAnswer: judged.submittedAnswer ?? '',
        }
      : null,
    outcome: user.bossHp === 0 ? 'victory' : user.bossHp === null ? 'defeat' : null,
  }
}

/**
 * Ouvre un combat : le joueur entre avec ses vies, trois au plus — une vie de
 * Vitalité ne passe pas la porte —, et c'est une tentative neuve. Ce qui
 * attendait la prochaine tentative n'est pas ancré : les Sorts n'agissent pas
 * en combat, l'effet attend la tentative d'ascension suivante. Les épreuves sont
 * tirées dans un ordre mélangé, et la première est servie.
 *
 * Rend false quand une autre requête vient de l'ouvrir, ou que le boss n'a pas
 * d'épreuves en base. Voir specs/boss.md.
 */
export async function enterBossFight(db: Database, user: User, rules: FloorRules, now: Date): Promise<boolean> {
  // Le joueur se réclame le combat d'abord : deux clics partis ensemble
  // tireraient chacun leurs épreuves. Pas sans épreuves en base : un catalogue
  // pas encore chargé laisse le joueur au palier.
  const [claimed] = await db
    .update(users)
    .set({
      bossHp: rules.bossHp,
      bossAttemptNumber: sql`${users.bossAttemptNumber} + 1`,
      lives: Math.min(user.lives, rules.lives),
      attemptStartedAt: now,
      attemptSeen: 0,
      streak: 0,
    })
    .where(and(
      eq(users.id, user.id),
      isNull(users.bossHp),
      eq(users.attemptStartedAt, user.attemptStartedAt),
      exists(db.select({ one: sql`1` }).from(flags).where(FIGHT_FLAGS)),
    ))
    .returning({ id: users.id })

  if (!claimed) {
    return false
  }

  // L'ascension qui a mené au palier est une tentative achevée : elle s'inscrit
  // avant que le combat ne prenne sa place. Le combat lui-même, sans question
  // vue, ne s'inscrira pas (#36).
  await closeAttempt(db, user, now)

  const drawn = db
    .select({ slug: flags.slug })
    .from(flags)
    .where(FIGHT_FLAGS)
    .orderBy(sql`RANDOM()`)
    .limit(rules.bossTrialsPerFight)
    .as('drawn')

  await db.batch([
    db.delete(bossTrials).where(eq(bossTrials.userId, user.id)),
    db.insert(bossTrials).select(db
      .select({
        userId: sql<number>`${user.id}`.as('user_id'),
        flagSlug: drawn.slug,
        position: sql<number>`row_number() over () - 1`.as('position'),
        // La première épreuve est servie d'emblée, les autres attendent leur tour.
        expiresAt: sql<Date | null>`case when row_number() over () = 1
          then ${Math.floor((now.getTime() + rules.bossTrialTimerMs) / 1000)} end`.as('expires_at'),
        resolvedAt: sql<Date | null>`null`.as('resolved_at'),
        correct: sql<boolean | null>`null`.as('correct'),
        submittedAnswer: sql<string | null>`null`.as('submitted_answer'),
      })
      .from(drawn)),
  ])

  return true
}

/**
 * Sert l'épreuve suivante, celle qui attend son tour en premier. Rien quand une
 * épreuve court déjà, ou quand il n'en reste plus.
 */
export async function serveNextTrial(db: Database, user: User, trials: HeldTrial[], rules: FloorRules, now: Date): Promise<void> {
  // ponytail: 10 épreuves suffisent toujours à trancher (7 PV + 3 vies) ; un
  // combat qui les épuiserait resterait sans épreuve. À revoir si un boss
  // s'écarte du modèle par défaut. Voir specs/boss.md#cadre-général.
  const next = trials.find(trial => trial.expiresAt === null)

  if (servedTrial(trials) || !next) {
    return
  }

  await db
    .update(bossTrials)
    .set({ expiresAt: new Date(now.getTime() + rules.bossTrialTimerMs) })
    .where(and(eq(bossTrials.userId, user.id), eq(bossTrials.position, next.position), isNull(bossTrials.expiresAt)))
}

/**
 * Juge l'épreuve servie. Juste, le boss perd un PV ; fausse ou expirée, le
 * joueur perd une vie. À zéro vie, c'est la défaite : les PV s'effacent et
 * l'attente démarre, comme une chute en ascension.
 *
 * Toutes les écritures partent dans un lot gardé sur l'épreuve encore ouverte,
 * celle qui la ferme en dernier : une seconde réponse partie en même temps
 * n'écrit rien. Voir `resolve` dans server/utils/game.ts.
 */
export async function resolveTrial(
  db: Database,
  user: User,
  trial: HeldTrial,
  answer: string,
  rules: FloorRules,
  now: Date,
): Promise<void> {
  const expired = trial.expiresAt === null || isExpired(trial.expiresAt, rules, now)
  const correct = !expired && isAnswerAccepted(answer, trial.acceptedAnswers)
  const lives = correct ? user.lives : user.lives - 1
  const defeated = lives <= 0

  const stillOpen = and(
    eq(bossTrials.userId, user.id),
    eq(bossTrials.position, trial.position),
    isNull(bossTrials.resolvedAt),
  )
  const whileOpen = exists(db.select({ one: sql`1` }).from(bossTrials).where(stillOpen))

  await db.batch([
    db
      .update(users)
      .set(correct
        ? { bossHp: sql`${users.bossHp} - 1` }
        : {
            lives,
            ...defeated ? { bossHp: null, ...cooldownFields(cooldownFrom(rules, now), now) } : {},
          })
      .where(and(eq(users.id, user.id), whileOpen)),
    db.update(bossTrials).set({ resolvedAt: now, correct, submittedAnswer: answer }).where(stillOpen),
  ])
}
