import { asc, count, eq, max, min, sql } from 'drizzle-orm'
import { anchorEffects } from './effects'
import { attempts, disputes, questions, seenQuestions, users } from '../db/schema'
import type { FloorRules } from './rules'
import type { Database } from '../db/client'
import type { User } from '../db/schema'

/**
 * Le parcours : ce que le profil montre du chemin déjà fait. Jamais l'état de
 * l'instant — la phase, les vies et l'attente vivent sur l'accueil et dans le
 * jeu, et n'ont rien à faire ici. Voir specs/ecrans.md#profil.
 */

/**
 * Ouvre une tentative : les vies reviennent, l'attente s'efface, et ce qui
 * attendait s'y ancre. Appelée aux deux endroits où une tentative commence, et
 * nulle part ailleurs — une vie rendue par une contestation poursuit celle en
 * cours et ne réveille donc aucun effet. Voir specs/validation.md#contestation.
 */
export async function openAttempt(db: Database, user: User, now: Date): Promise<FloorRules> {
  // Les effets en attente s'ancrent sur cette tentative-ci, et les règles
  // qu'elle jouera en tiennent compte : c'est le même instant qui sert d'ancre
  // et de début de tentative, et les deux s'écrivent ici pour qu'aucun appelant
  // ne puisse les désaccorder. Voir specs/bonus.md#ancrage-et-durée-de-vie.
  const rules = await anchorEffects(db, user, now)

  await db
    .update(users)
    // Tentative neuve : son décompte de questions vues repart de zéro, dans la
    // même écriture que son instant d'ouverture — les deux disent la même chose,
    // ils ne peuvent pas se désaccorder. Voir server/db/schema.ts.
    .set({
      lives: rules.lives,
      cooldownUntil: null,
      cooldownStartedAt: null,
      attemptStartedAt: now,
      attemptSeen: 0,
      // La série ne traverse pas les tentatives : « sans faute » veut dire d'une
      // seule traite, et une tentative neuve est justement ce qui coupe la traite.
      // Voir specs/succes.md#série-sans-faute.
      streak: 0,
    })
    .where(eq(users.id, user.id))

  return rules
}

/**
 * Clôt la tentative en cours et enregistre sa longueur, en questions vues.
 *
 * Appelée au moment où la tentative suivante s'ouvre, jamais à la perte de la
 * dernière vie : entre les deux, une contestation acceptée peut rendre une vie
 * et faire repartir la même tentative. Ce qui est écrit ici ne bouge plus.
 *
 * Une tentative sans aucune question vue n'en est pas une : rien n'est écrit.
 */
export async function closeAttempt(db: Database, user: User, now: Date): Promise<void> {
  // Le joueur porte déjà sa longueur : la recompter lisait une ligne par
  // question qu'il a vue. Voir server/db/schema.ts.
  const seen = user.attemptSeen

  if (seen === 0) {
    return
  }

  await db.insert(attempts).values({
    userId: user.id,
    startedAt: user.attemptStartedAt,
    endedAt: now,
    seen,
    floor: user.currentFloor,
  })
}

export interface JourneyStats {
  /** L'étage atteint — on ne redescend jamais. */
  floor: number
  /** Questions vues à cet étage, sur ce qu'il contient. */
  floorSeen: number
  floorTotal: number
  /** Questions vues depuis le début, justes et fausses confondues. */
  seen: number
  correct: number
  /** La plus longue série de bonnes réponses d'affilée, tous étages confondus. */
  bestStreak: number
  /** Tentatives achevées. Celle en cours n'en est pas encore une. */
  attempts: number
  /** La plus longue et la plus courte, en questions vues. Null sans tentative achevée. */
  longestAttempt: number | null
  shortestAttempt: number | null
  /** Contestations ouvertes, et celles que l'arbitrage a données au joueur. */
  disputes: number
  disputesWon: number
}

/**
 * Le parcours d'un joueur, en quatre requêtes : les compteurs d'un côté, les
 * questions vues dans l'ordre de l'autre — la série la plus longue ne se lit
 * qu'en les parcourant.
 */
export async function journeyStats(db: Database, user: User): Promise<JourneyStats> {
  const [totals] = await db
    .select({
      seen: count(),
      correct: sql<number>`sum(case when ${seenQuestions.correct} then 1 else 0 end)`,
      floorSeen: sql<number>`sum(case when ${seenQuestions.floor} = ${user.currentFloor} then 1 else 0 end)`,
    })
    .from(seenQuestions)
    .where(eq(seenQuestions.userId, user.id))

  const [floorTotal] = await db
    .select({ value: count() })
    .from(questions)
    .where(eq(questions.floor, user.currentFloor))

  const [runs] = await db
    .select({
      value: count(),
      longest: max(attempts.seen),
      shortest: min(attempts.seen),
    })
    .from(attempts)
    .where(eq(attempts.userId, user.id))

  const [contested] = await db
    .select({
      value: count(),
      won: sql<number>`sum(case when ${disputes.status} = 'accepted' then 1 else 0 end)`,
    })
    .from(disputes)
    .where(eq(disputes.userId, user.id))

  return {
    floor: user.currentFloor,
    floorSeen: totals.floorSeen ?? 0,
    floorTotal: floorTotal.value,
    seen: totals.seen,
    correct: totals.correct ?? 0,
    bestStreak: await bestStreak(db, user),
    attempts: runs.value,
    longestAttempt: runs.longest,
    shortestAttempt: runs.shortest,
    disputes: contested.value,
    disputesWon: contested.won ?? 0,
  }
}

/**
 * La plus longue série de bonnes réponses d'affilée. Elle traverse les étages :
 * une série que le palier coupe n'a pas été interrompue par le joueur.
 */
async function bestStreak(db: Database, user: User): Promise<number> {
  const rows = await db
    .select({ correct: seenQuestions.correct })
    .from(seenQuestions)
    .where(eq(seenQuestions.userId, user.id))
    .orderBy(asc(seenQuestions.seenAt))

  let best = 0
  let current = 0

  for (const row of rows) {
    current = row.correct ? current + 1 : 0
    best = Math.max(best, current)
  }

  return best
}
