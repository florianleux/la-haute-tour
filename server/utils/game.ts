import { and, count, eq, notExists, sql } from 'drizzle-orm'
import { isAnswerAccepted } from './answers'
import { rulesForFloor } from './rules'
import {
  FLOOR_COUNT,
  acceptedAnswers,
  missedPool,
  questions,
  reservations,
  seenQuestions,
  users,
} from '../db/schema'
import type { Database } from '../db/client'
import type { Reservation, User } from '../db/schema'

/** See specs/mecanique.md#machine-à-états — the one definition of where a player stands. */
export type Phase = 'ascent' | 'cooldown' | 'recovery' | 'floorEnd' | 'gameOver'

export interface ServedQuestion {
  id: string
  statement: string
  /** ISO 8601, fixed when the question was reserved. The countdown only renders it. */
  expiresAt: string
}

export interface Verdict {
  correct: boolean
  /** What the player is shown on failure; never used for matching. */
  answerLabel: string
  submittedAnswer: string
  lifeLost: boolean
}

export interface GameState {
  phase: Phase
  floor: number
  lives: number
  /** False only while the player has never resolved nor reserved anything. */
  started: boolean
  question: ServedQuestion | null
  verdict: Verdict | null
  /** ISO 8601 end of the wait, null outside a wait. */
  cooldownUntil: string | null
}

async function liveReservation(db: Database, userId: number): Promise<Reservation | undefined> {
  const [reservation] = await db
    .select()
    .from(reservations)
    .where(eq(reservations.userId, userId))
    .limit(1)

  return reservation
}

async function seenCount(db: Database, userId: number, floor: number): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(seenQuestions)
    .where(and(eq(seenQuestions.userId, userId), eq(seenQuestions.floor, floor)))

  return row.value
}

async function floorQuestionCount(db: Database, floor: number): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(questions)
    .where(eq(questions.floor, floor))

  return row.value
}

async function acceptedFor(db: Database, questionId: string): Promise<string[]> {
  const rows = await db
    .select({ text: acceptedAnswers.text })
    .from(acceptedAnswers)
    .where(eq(acceptedAnswers.questionId, questionId))

  return rows.map(row => row.text)
}

/**
 * Past the deadline, plus the grace the rules allow for the trip back. The
 * countdown the player saw hit zero a moment earlier.
 */
function isExpired(reservation: Reservation, graceMs: number, now: Date): boolean {
  return now.getTime() > reservation.expiresAt.getTime() + graceMs
}

/** Same question, read through the rules of the floor the player stands on. */
function isExpiredForUser(reservation: Reservation, user: User, now: Date): boolean {
  return isExpired(reservation, rulesForFloor(user.currentFloor).latencyGraceMs, now)
}

/**
 * Records the outcome of a reservation: the question becomes seen, a failure costs
 * a life and joins the missed pool, and losing the last life starts the wait.
 */
async function resolve(
  db: Database,
  userId: number,
  reservation: Reservation,
  answer: string,
  now: Date,
): Promise<void> {
  // Read the player back rather than trusting the caller's copy: lives and floor
  // decide what this costs, and a stale copy would cost the wrong thing.
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
  const rules = rulesForFloor(user.currentFloor)
  const expired = isExpired(reservation, rules.latencyGraceMs, now)
  const correct = !expired && isAnswerAccepted(answer, await acceptedFor(db, reservation.questionId))

  await db
    .update(reservations)
    .set({ resolvedAt: now, correct, submittedAnswer: answer })
    .where(eq(reservations.userId, user.id))

  await db
    .insert(seenQuestions)
    .values({
      userId: user.id,
      questionId: reservation.questionId,
      floor: user.currentFloor,
      correct,
    })
    .onConflictDoNothing()

  if (correct) {
    return
  }

  await db
    .insert(missedPool)
    .values({
      userId: user.id,
      questionId: reservation.questionId,
      floor: user.currentFloor,
      lastFailedAt: now,
    })
    // Already missed on this floor: the counter goes back to zero and the date moves up.
    .onConflictDoUpdate({
      target: [missedPool.userId, missedPool.questionId],
      set: { poolSuccesses: 0, lastFailedAt: now },
    })

  const lives = user.lives - 1
  await db
    .update(users)
    .set({
      lives,
      cooldownUntil: lives <= 0 ? new Date(now.getTime() + rules.cooldownMs) : null,
    })
    .where(eq(users.id, user.id))
}

function servedQuestion(
  reservation: Reservation,
  statement: string,
): ServedQuestion {
  return {
    id: reservation.questionId,
    statement,
    expiresAt: reservation.expiresAt.toISOString(),
  }
}

async function buildState(db: Database, userId: number, now: Date): Promise<GameState> {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
  const reservation = await liveReservation(db, user.id)
  const seen = await seenCount(db, user.id, user.currentFloor)

  const base = {
    floor: user.currentFloor,
    lives: user.lives,
    started: seen > 0 || reservation !== undefined,
    question: null as ServedQuestion | null,
    verdict: null as Verdict | null,
    cooldownUntil: user.cooldownUntil?.toISOString() ?? null,
  }

  if (reservation) {
    const [question] = await db
      .select()
      .from(questions)
      .where(eq(questions.id, reservation.questionId))
      .limit(1)

    // The verdict is carried whatever the phase: the question that took the last
    // life is precisely the one whose answer the player still has to read.
    if (reservation.resolvedAt) {
      base.verdict = {
        correct: reservation.correct ?? false,
        answerLabel: question.answerLabel,
        submittedAnswer: reservation.submittedAnswer ?? '',
        lifeLost: !reservation.correct,
      }
    }
    else {
      base.question = servedQuestion(reservation, question.statement)
    }
  }

  if (user.lives <= 0) {
    // Once the wait has elapsed the player owes a recovery; what happens there —
    // including a pool too small to be worth one — belongs to its own ticket.
    const waiting = user.cooldownUntil !== null && now < user.cooldownUntil
    return { ...base, question: null, phase: waiting ? 'cooldown' : 'recovery' }
  }

  if (!reservation && seen >= await floorQuestionCount(db, user.currentFloor)) {
    return { ...base, phase: user.currentFloor >= FLOOR_COUNT ? 'gameOver' : 'floorEnd' }
  }

  return { ...base, phase: 'ascent' }
}

/**
 * Where the player stands. Reading draws no question and starts no clock: it hands
 * back the live reservation, the verdict waiting to be read, or — for a reservation
 * whose deadline has passed — resolves it as the failure it already is.
 */
export async function readGameState(db: Database, user: User, now: Date): Promise<GameState> {
  const reservation = await liveReservation(db, user.id)

  // Same grace as an answer gets: a read landing a hair after the deadline must
  // not close a question whose answer is still in flight.
  if (reservation && !reservation.resolvedAt && isExpiredForUser(reservation, user, now)) {
    await resolve(db, user.id, reservation, '', now)
  }

  return buildState(db, user.id, now)
}

/**
 * The player's own move: resolve whatever verdict they were reading, then reserve a
 * question drawn at random among those they have not seen on this floor.
 */
export async function serveNextQuestion(db: Database, user: User, now: Date): Promise<GameState> {
  const reservation = await liveReservation(db, user.id)

  if (reservation && !reservation.resolvedAt) {
    // A live reservation is not replaced: fleeing a question costs what a wrong
    // answer costs. An expired one resolves first, then the next is drawn.
    if (!isExpiredForUser(reservation, user, now)) {
      return buildState(db, user.id, now)
    }

    await resolve(db, user.id, reservation, '', now)
  }

  // Read back: the resolution just above may have taken the last life, and the
  // floor is what decides which questions are on the table.
  const [fresh] = await db.select().from(users).where(eq(users.id, user.id)).limit(1)
  if (fresh.lives <= 0) {
    return buildState(db, user.id, now)
  }

  // Left to the database: pulling every seen id back to embed it in a NOT IN
  // grows with the deck, and the deck is the thing meant to grow.
  const alreadySeen = db
    .select({ one: sql`1` })
    .from(seenQuestions)
    .where(and(
      eq(seenQuestions.userId, user.id),
      eq(seenQuestions.questionId, questions.id),
    ))

  const [next] = await db
    .select()
    .from(questions)
    .where(and(eq(questions.floor, fresh.currentFloor), notExists(alreadySeen)))
    .orderBy(sql`RANDOM()`)
    .limit(1)

  if (!next) {
    await db.delete(reservations).where(eq(reservations.userId, user.id))
    return buildState(db, user.id, now)
  }

  // One reservation per player: this either creates it or replaces the resolved
  // one the player was reading, verdict included.
  const reserved = {
    questionId: next.id,
    expiresAt: new Date(now.getTime() + rulesForFloor(fresh.currentFloor).ascentTimerMs),
    createdAt: now,
    resolvedAt: null,
    correct: null,
    submittedAnswer: null,
  }

  await db
    .insert(reservations)
    .values({ userId: user.id, ...reserved })
    .onConflictDoUpdate({ target: reservations.userId, set: reserved })

  return buildState(db, user.id, now)
}

/**
 * The player's answer. A submission about a reservation that is already resolved —
 * or about none at all — is ignored: the device that sent it is late, not at fault.
 */
export async function submitAnswer(
  db: Database,
  user: User,
  answer: string,
  now: Date,
): Promise<GameState> {
  const reservation = await liveReservation(db, user.id)

  if (reservation && !reservation.resolvedAt) {
    await resolve(db, user.id, reservation, answer, now)
  }

  return buildState(db, user.id, now)
}
