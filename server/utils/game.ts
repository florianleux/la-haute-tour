import { and, asc, count, desc, eq, isNull, notExists, sql } from 'drizzle-orm'
import {
  canDrawRecovery,
  isExpired,
  judgeAnswer,
  judgeRecovery,
  movePoolCounter,
  phaseOf,
  resumesRecovery,
} from './mechanics'
import { rulesForFloor } from './rules'
import {
  acceptedAnswers,
  missedPool,
  questions,
  recoveryQuestions,
  reservations,
  seenQuestions,
  users,
} from '../db/schema'
import type { Phase } from './mechanics'
import type { Database } from '../db/client'
import type { Question, Reservation, User } from '../db/schema'

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

export interface RecoveryProgress {
  total: number
  played: number
  successes: number
  /** Whether finishing on this tally gives the lives back. */
  resumes: boolean
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
  /** Tally of the recovery under way, null outside one. */
  recovery: RecoveryProgress | null
}

/**
 * Everything the phase is derived from, in as few round trips as possible.
 *
 * The database is remote and every query is a network hop, so this is deliberately
 * two of them rather than one per fact: the player and their two counters travel
 * together, and the reservation brings its question along.
 */
export interface PlayerSnapshot {
  user: User
  /** Questions seen on the current floor. */
  seen: number
  /** Questions the current floor holds. */
  floorTotal: number
  reservation?: Reservation
  /** The reserved question, loaded with the reservation. */
  question?: Question
}

async function loadSnapshot(db: Database, userId: number): Promise<PlayerSnapshot> {
  const [row] = await db
    .select({
      user: users,
      seen: sql<number>`(select count(*) from ${seenQuestions}
        where ${seenQuestions.userId} = ${users.id}
          and ${seenQuestions.floor} = ${users.currentFloor})`,
      floorTotal: sql<number>`(select count(*) from ${questions}
        where ${questions.floor} = ${users.currentFloor})`,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  const [held] = await db
    .select({ reservation: reservations, question: questions })
    .from(reservations)
    .innerJoin(questions, eq(questions.id, reservations.questionId))
    .where(eq(reservations.userId, userId))
    .limit(1)

  return {
    user: row.user,
    seen: row.seen,
    floorTotal: row.floorTotal,
    reservation: held?.reservation,
    question: held?.question,
  }
}

async function poolSize(db: Database, user: User): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(missedPool)
    .where(and(eq(missedPool.userId, user.id), eq(missedPool.floor, user.currentFloor)))

  return row.value
}

async function hasRecoveryRun(db: Database, userId: number): Promise<boolean> {
  const [row] = await db
    .select({ value: count() })
    .from(recoveryQuestions)
    .where(eq(recoveryQuestions.userId, userId))

  return row.value > 0
}

/** The tally of the recovery under way, or null when none is. */
async function recoveryProgress(db: Database, user: User): Promise<RecoveryProgress | null> {
  const drawn = await db
    .select()
    .from(recoveryQuestions)
    .where(eq(recoveryQuestions.userId, user.id))

  if (!drawn.length) {
    return null
  }

  const played = drawn.filter(row => row.correct !== null)
  const successes = played.filter(row => row.correct).length

  return {
    total: drawn.length,
    played: played.length,
    successes,
    resumes: resumesRecovery(successes, rulesForFloor(user.currentFloor)),
  }
}

async function acceptedFor(db: Database, questionId: string): Promise<string[]> {
  const rows = await db
    .select({ text: acceptedAnswers.text })
    .from(acceptedAnswers)
    .where(eq(acceptedAnswers.questionId, questionId))

  return rows.map(row => row.text)
}

/**
 * A recovery answer costs no life and moves no progress: the question was already
 * seen. What it moves is the question's own counter — up on a right answer, back to
 * zero on a wrong one, out of the pool once the threshold is reached.
 * See specs/mecanique.md#pool-échecs.
 */
async function resolveRecovery(
  db: Database,
  user: User,
  questionId: string,
  correct: boolean,
  now: Date,
): Promise<void> {
  await db
    .update(recoveryQuestions)
    .set({ correct })
    .where(and(
      eq(recoveryQuestions.userId, user.id),
      eq(recoveryQuestions.questionId, questionId),
    ))

  const [entry] = await db
    .select()
    .from(missedPool)
    .where(and(eq(missedPool.userId, user.id), eq(missedPool.questionId, questionId)))
    .limit(1)

  if (!entry) {
    return
  }

  const membership = and(
    eq(missedPool.userId, user.id),
    eq(missedPool.questionId, questionId),
  )
  const move = movePoolCounter(entry, correct, rulesForFloor(user.currentFloor), now)

  if (move.leaves) {
    await db.delete(missedPool).where(membership)
    return
  }

  await db
    .update(missedPool)
    .set({ poolSuccesses: move.poolSuccesses, lastFailedAt: move.lastFailedAt })
    .where(membership)
}

/** La même question, lue à travers les règles de l'étage où se tient le joueur. */
function isExpiredForUser(reservation: Reservation, user: User, now: Date): boolean {
  return isExpired(reservation.expiresAt, rulesForFloor(user.currentFloor), now)
}

/** Ce que la résolution vient d'écrire, pour éviter d'aller le relire. */
interface Resolution {
  user: User
  reservation: Reservation
  /** 1 quand une question vient d'entrer dans les questions vues. */
  seenDelta: number
}

/**
 * Records the outcome of a reservation: the question becomes seen, a failure costs
 * a life and joins the missed pool, and losing the last life starts the wait.
 *
 * Returns the rows as it left them: the caller rebuilds the state from those rather
 * than paying a round trip to read back what it just wrote.
 */
async function resolve(
  db: Database,
  user: User,
  reservation: Reservation,
  answer: string,
  now: Date,
): Promise<Resolution> {
  // Le joueur vient du snapshot de l'appelant, chargé dans le même aller-retour
  // que la réservation : le relire ici coûterait un hop pour la même ligne.
  const rules = rulesForFloor(user.currentFloor)
  const judgement = judgeAnswer({
    user,
    reservation,
    acceptedAnswers: await acceptedFor(db, reservation.questionId),
    answer,
    rules,
  }, now)
  const { correct } = judgement

  await db
    .update(reservations)
    .set({ resolvedAt: now, correct, submittedAnswer: answer })
    .where(eq(reservations.userId, user.id))

  const resolved: Reservation = {
    ...reservation,
    resolvedAt: now,
    correct,
    submittedAnswer: answer,
  }

  if (reservation.mode === 'recovery') {
    // Aucune vie perdue, aucune progression : le rattrapage ne joue que sur les
    // compteurs du Pool Échecs.
    await resolveRecovery(db, user, reservation.questionId, correct, now)
    return { user, reservation: resolved, seenDelta: judgement.seenDelta }
  }

  await db
    .insert(seenQuestions)
    .values({
      userId: user.id,
      questionId: reservation.questionId,
      floor: user.currentFloor,
      correct,
    })
    .onConflictDoNothing()

  if (!judgement.entersPool) {
    return { user, reservation: resolved, seenDelta: judgement.seenDelta }
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

  const { livesAfter: lives, cooldownUntil } = judgement

  await db
    .update(users)
    .set({ lives, cooldownUntil })
    .where(eq(users.id, user.id))

  return {
    user: { ...user, lives, cooldownUntil },
    reservation: resolved,
    seenDelta: judgement.seenDelta,
  }
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

/**
 * Derives the phase from a snapshot. The only query it may still make is the
 * recovery tally, and only when the player has no lives left: a recovery run
 * cannot exist otherwise — it is created with the lives at zero and cleared when
 * they come back.
 */
async function stateFrom(db: Database, snapshot: PlayerSnapshot, now: Date): Promise<GameState> {
  const { user, reservation, question, seen, floorTotal } = snapshot

  const base = {
    floor: user.currentFloor,
    lives: user.lives,
    started: seen > 0 || reservation !== undefined,
    question: null as ServedQuestion | null,
    verdict: null as Verdict | null,
    cooldownUntil: user.cooldownUntil?.toISOString() ?? null,
    recovery: user.lives <= 0 ? await recoveryProgress(db, user) : null,
  }

  if (reservation && question) {
    // The verdict is carried whatever the phase: the question that took the last
    // life is precisely the one whose answer the player still has to read.
    if (reservation.resolvedAt) {
      base.verdict = {
        correct: reservation.correct ?? false,
        answerLabel: question.answerLabel,
        submittedAnswer: reservation.submittedAnswer ?? '',
        // Le rattrapage ne coûte aucune vie : seule une erreur d'ascension en
        // fait perdre une.
        lifeLost: reservation.mode === 'ascent' && !reservation.correct,
      }
    }
    else {
      base.question = servedQuestion(reservation, question.statement)
    }
  }

  const phase = phaseOf({ user, hasReservation: reservation !== undefined, seen, floorTotal }, now)

  // Rien du jeu n'est servi pendant l'attente : le pool se lit à part, comme la
  // fiche de révision qu'il est censé être.
  return { ...base, phase, question: phase === 'cooldown' ? null : base.question }
}

async function buildState(db: Database, userId: number, now: Date): Promise<GameState> {
  return stateFrom(db, await loadSnapshot(db, userId), now)
}

/**
 * Where the player stands. Reading draws no question and starts no clock: it hands
 * back the live reservation, the verdict waiting to be read, or — for a reservation
 * whose deadline has passed — resolves it as the failure it already is.
 */
export async function readGameState(db: Database, user: User, now: Date): Promise<GameState> {
  const snapshot = await loadSnapshot(db, user.id)
  const { reservation } = snapshot

  // Same grace as an answer gets: a read landing a hair after the deadline must
  // not close a question whose answer is still in flight.
  const expired = reservation !== undefined
    && !reservation.resolvedAt
    && isExpiredForUser(reservation, snapshot.user, now)

  if (expired) {
    const resolution = await resolve(db, snapshot.user, reservation, '', now)

    // Rien d'autre n'a bougé : l'attente ne peut pas s'achever dans la seconde où
    // elle démarre. On rend ce qui vient d'être écrit.
    return stateFrom(db, {
      ...snapshot,
      user: resolution.user,
      reservation: resolution.reservation,
      seen: snapshot.seen + resolution.seenDelta,
    }, now)
  }

  // Only worth a look at the end of a wait — the common read walks past it.
  const waitOver = snapshot.user.lives <= 0
    && snapshot.user.cooldownUntil !== null
    && now >= snapshot.user.cooldownUntil

  if (!waitOver) {
    return stateFrom(db, snapshot, now)
  }

  await resumeIfPoolTooSmall(db, snapshot.user, now)

  return buildState(db, user.id, now)
}

/**
 * A wait that ends on a pool too small to draw a recovery from simply gives the
 * lives back. Nothing is reserved and no clock starts — the phase follows from the
 * time having passed. See specs/mecanique.md#tentative-attente-et-rattrapage.
 */
async function resumeIfPoolTooSmall(db: Database, user: User, now: Date): Promise<void> {
  const elapsed = user.cooldownUntil !== null && now >= user.cooldownUntil

  if (user.lives > 0 || !elapsed || await hasRecoveryRun(db, user.id)) {
    return
  }

  const rules = rulesForFloor(user.currentFloor)
  if (canDrawRecovery(await poolSize(db, user), rules)) {
    return
  }

  await db
    .update(users)
    .set({ lives: rules.lives, cooldownUntil: null })
    .where(eq(users.id, user.id))
}

/**
 * The player's own move: resolve whatever verdict they were reading, then reserve a
 * question drawn at random among those they have not seen on this floor.
 */
export async function serveNextQuestion(db: Database, user: User, now: Date): Promise<GameState> {
  const snapshot = await loadSnapshot(db, user.id)
  const { reservation } = snapshot
  // Le snapshot décrit fidèlement le joueur tant que rien n'a été résolu ici.
  let fresh = snapshot.user
  let seenDelta = 0

  if (reservation && !reservation.resolvedAt) {
    // A live reservation is not replaced: fleeing a question costs what a wrong
    // answer costs. An expired one resolves first, then the next is drawn.
    if (!isExpiredForUser(reservation, snapshot.user, now)) {
      return stateFrom(db, snapshot, now)
    }

    const resolution = await resolve(db, snapshot.user, reservation, '', now)
    fresh = resolution.user
    seenDelta = resolution.seenDelta
  }

  if (fresh.lives <= 0) {
    return advanceRecovery(db, fresh, now)
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

  const expiresAt = new Date(now.getTime() + rulesForFloor(fresh.currentFloor).ascentTimerMs)
  await reserve(db, user.id, next.id, 'ascent', expiresAt, now)

  // L'état renvoyé est exactement ce qu'on vient d'écrire : le relire coûterait
  // deux allers-retours de plus pour la même réponse.
  return stateFrom(db, {
    user: fresh,
    // Une résolution juste au-dessus a pu ajouter une question vue — jamais en
    // rattrapage, d'où le delta rendu par resolve() plutôt qu'un « +1 » supposé.
    seen: snapshot.seen + seenDelta,
    floorTotal: snapshot.floorTotal,
    reservation: {
      userId: user.id,
      questionId: next.id,
      mode: 'ascent',
      expiresAt,
      createdAt: now,
      resolvedAt: null,
      correct: null,
      submittedAnswer: null,
    },
    question: next,
  }, now)
}

/** Reserves one question for `mode`, replacing whatever the player was holding. */
async function reserve(
  db: Database,
  userId: number,
  questionId: string,
  mode: 'ascent' | 'recovery',
  expiresAt: Date,
  now: Date,
): Promise<void> {
  const reserved = {
    questionId,
    mode,
    expiresAt,
    createdAt: now,
    resolvedAt: null,
    correct: null,
    submittedAnswer: null,
  }

  await db
    .insert(reservations)
    .values({ userId, ...reserved })
    .onConflictDoUpdate({ target: reservations.userId, set: reserved })
}

/**
 * The player has no lives left. Either the wait is still running — nothing to do —
 * or a recovery starts, continues, or ends here. Every drawn question is played,
 * even once the threshold is reached: it is the only place a pooled question moves
 * towards leaving the pool. See specs/mecanique.md#déroulement-du-rattrapage.
 */
async function advanceRecovery(db: Database, user: User, now: Date): Promise<GameState> {
  const waiting = user.cooldownUntil !== null && now < user.cooldownUntil
  if (waiting) {
    return buildState(db, user.id, now)
  }

  const rules = rulesForFloor(user.currentFloor)

  if (!await hasRecoveryRun(db, user.id)) {
    const drawn = await db
      .select()
      .from(missedPool)
      .where(and(eq(missedPool.userId, user.id), eq(missedPool.floor, user.currentFloor)))
      .orderBy(sql`RANDOM()`)
      .limit(rules.recoveryQuestions)

    if (!canDrawRecovery(drawn.length, rules)) {
      // Trop maigre pour y tirer : l'attente se termine et les vies reviennent.
      await resumeIfPoolTooSmall(db, user, now)
      return buildState(db, user.id, now)
    }

    await db.insert(recoveryQuestions).values(
      drawn.map((entry, position) => ({ userId: user.id, questionId: entry.questionId, position })),
    )
  }

  const [nextUp] = await db
    .select()
    .from(recoveryQuestions)
    .where(and(eq(recoveryQuestions.userId, user.id), isNull(recoveryQuestions.correct)))
    .orderBy(recoveryQuestions.position)
    .limit(1)

  if (!nextUp) {
    return finishRecovery(db, user, now)
  }

  await reserve(
    db,
    user.id,
    nextUp.questionId,
    'recovery',
    new Date(now.getTime() + rules.recoveryTimerMs),
    now,
  )

  return buildState(db, user.id, now)
}

/**
 * Every drawn question is played: one right answer gives the lives back, none sends
 * the player into a shorter wait before another recovery.
 */
async function finishRecovery(db: Database, user: User, now: Date): Promise<GameState> {
  const rules = rulesForFloor(user.currentFloor)
  const progress = await recoveryProgress(db, user)
  const verdict = judgeRecovery(progress?.successes ?? 0, rules, now)

  await db.delete(recoveryQuestions).where(eq(recoveryQuestions.userId, user.id))
  await db.delete(reservations).where(eq(reservations.userId, user.id))

  await db
    .update(users)
    .set({ lives: verdict.livesAfter, cooldownUntil: verdict.cooldownUntil })
    .where(eq(users.id, user.id))

  return buildState(db, user.id, now)
}

export interface MissedPoolEntryView {
  questionId: string
  statement: string
  /** Shown here on purpose: the wait screen is a revision sheet, not a punishment. */
  answerLabel: string
  poolSuccesses: number
  lastFailedAt: string
}

export interface MissedPoolPage {
  entries: MissedPoolEntryView[]
  total: number
}

export interface MissedPoolQuery {
  limit: number
  offset: number
  /** By last failure: newest first by default, reversible. */
  order: 'asc' | 'desc'
}

/**
 * The missed pool of the player's floor, answers included. Read on its own rather
 * than carried by the game state: it is paged, and the phase doesn't change while
 * the player scrolls it. See specs/ecrans.md.
 */
export async function readMissedPool(
  db: Database,
  user: User,
  query: MissedPoolQuery,
): Promise<MissedPoolPage> {
  const onThisFloor = and(
    eq(missedPool.userId, user.id),
    eq(missedPool.floor, user.currentFloor),
  )

  const rows = await db
    .select({
      questionId: missedPool.questionId,
      statement: questions.statement,
      answerLabel: questions.answerLabel,
      poolSuccesses: missedPool.poolSuccesses,
      lastFailedAt: missedPool.lastFailedAt,
    })
    .from(missedPool)
    .innerJoin(questions, eq(questions.id, missedPool.questionId))
    .where(onThisFloor)
    .orderBy(query.order === 'asc' ? asc(missedPool.lastFailedAt) : desc(missedPool.lastFailedAt))
    .limit(query.limit)
    .offset(query.offset)

  const [{ value: total }] = await db
    .select({ value: count() })
    .from(missedPool)
    .where(onThisFloor)

  return {
    total,
    entries: rows.map(row => ({ ...row, lastFailedAt: row.lastFailedAt.toISOString() })),
  }
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
  const snapshot = await loadSnapshot(db, user.id)
  const { reservation } = snapshot

  if (!reservation || reservation.resolvedAt) {
    // Rien à résoudre : l'appareil qui a envoyé ça est en retard, pas fautif.
    return stateFrom(db, snapshot, now)
  }

  const resolution = await resolve(db, snapshot.user, reservation, answer, now)

  return stateFrom(db, {
    ...snapshot,
    user: resolution.user,
    reservation: resolution.reservation,
    seen: snapshot.seen + resolution.seenDelta,
  }, now)
}
