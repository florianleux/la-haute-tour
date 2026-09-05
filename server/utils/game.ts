import { and, asc, count, desc, eq, gt, isNull, sql } from 'drizzle-orm'
import {
  canDrawRecovery,
  cooldownFrom,
  isExpired,
  isLootQuestion,
  judgeAnswer,
  judgeRecovery,
  movePoolCounter,
  phaseOf,
  rollChest,
  resumesRecovery,
} from './mechanics'
import { floorSize } from './deck'
import { closeAttempt } from './journey'
import { rulesForFloor } from './rules'
import {
  acceptedAnswers,
  disputes,
  missedPool,
  questions,
  recoveryQuestions,
  focusLosses,
  inventory,
  settings,
  reservations,
  seenQuestions,
  users,
} from '../db/schema'
import type { AnswerSource, Phase } from './mechanics'
import type { FloorRules } from './rules'
import type { ChestState, SpellId } from '../../shared/utils/spells'
import type { Database } from '../db/client'
import type { Question, Reservation, User } from '../db/schema'

export interface ServedQuestion {
  id: string
  statement: string
  /** ISO 8601, fixed when the question was reserved. The countdown only renders it. */
  expiresAt: string
  /**
   * Combien de temps le joueur peut quitter la page sans que sa réponse parte.
   * Servi avec la question parce que c'est une règle du jeu, pas une constante
   * du client. Voir specs/anti-triche.md#perte-de-focus.
   */
  focusGraceMs: number
  /**
   * Ce passage-là vaut un coffre s'il est juste. Dérivé à la lecture du rang
   * qu'occupera la question dans les questions résolues de l'étage, jamais
   * stocké — comme la phase. Le statut est donc stable tant que l'étage l'est :
   * une question ajoutée ou retirée du deck par l'admin sous une réservation
   * vivante peut le faire basculer, au même titre qu'elle déplace le palier.
   * Voir specs/bonus.md#question-loot.
   */
  lootQuestion: boolean
}

export interface Verdict {
  /** La question jugée — c'est elle que le joueur conteste, s'il conteste. */
  questionId: string
  correct: boolean
  /** What the player is shown on failure; never used for matching. */
  answerLabel: string
  submittedAnswer: string
  lifeLost: boolean
}

export interface ChestView {
  /** False tant que le joueur ne l'a pas ouvert : le dé n'est pas encore jeté. */
  opened: boolean
  /** Vrai quand le coffre ouvert était piégé. Dit une fois, plutôt que déduit
   * d'un sort absent à chaque endroit qui le lit. */
  mimic: boolean
  /** Le sort obtenu. Null sur un coffre fermé comme sur un Mimic. */
  spell: SpellId | null
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
  /**
   * Le sort du dernier rattrapage, posé une fois toutes ses questions jouées.
   * Un écran intermédiaire le lit avant que le joueur ne reprenne l'ascension
   * (succès) ou ne voie sa nouvelle attente (échec). Effacé au clic suivant.
   */
  recoveryResult: 'resumed' | 'failed' | null
  /** Questions vues à l'étage courant. */
  floorSeen: number
  /** Questions que l'étage courant contient. */
  floorTotal: number
  /** Questions vues depuis le début de la tentative en cours. */
  attemptSeen: number
  /**
   * Le coffre de la question loot qui vient d'être réussie, null partout
   * ailleurs. Tant qu'il est fermé, rien ne sert la question suivante.
   */
  chest: ChestView | null
  /**
   * Le jeu est fermé **pour ce joueur-là** : l'administration a coupé et il n'est
   * pas admin. Une question déjà servie et son verdict restent lisibles ; c'est le
   * passage à la suite qui n'existe plus. Voir specs/admin.md#maintenance.
   */
  maintenance: boolean
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
  /** Le jeu est fermé par l'administration. Vrai pour tout le monde, admins compris. */
  gameClosed: boolean
  /** Questions seen on the current floor. */
  seen: number
  /** Questions the current floor holds. */
  floorTotal: number
  /** Questions seen since the current attempt started. */
  attemptSeen: number
  reservation?: Reservation
  /** The reserved question, loaded with the reservation. */
  question?: Question
}

/**
 * La phase d'un instantané. `hasLiveReservation` reste un argument : après un
 * clic, la question que le joueur tenait n'est plus en jeu alors qu'elle est
 * encore dans l'instantané, avec son verdict.
 */
function phaseOfSnapshot(snapshot: PlayerSnapshot, hasLiveReservation: boolean, now: Date): Phase {
  return phaseOf({
    user: snapshot.user,
    hasLiveReservation,
    seen: snapshot.seen,
    floorTotal: snapshot.floorTotal,
  }, now)
}

/** Une question encore en jeu, c'est-à-dire réservée et non résolue. */
function holdsQuestion(snapshot: PlayerSnapshot): boolean {
  return snapshot.reservation !== undefined && snapshot.reservation.resolvedAt === null
}

async function loadSnapshot(db: Database, userId: number, now: Date): Promise<PlayerSnapshot> {
  const [row] = await db
    .select({
      user: users,
      seen: sql<number>`(select count(*) from ${seenQuestions}
        where ${seenQuestions.userId} = ${users.id}
          and ${seenQuestions.floor} = ${users.currentFloor})`,
      attemptSeen: sql<number>`(select count(*) from ${seenQuestions}
        where ${seenQuestions.userId} = ${users.id}
          and ${seenQuestions.seenAt} >= ${users.attemptStartedAt})`,
      // Lu avec le joueur plutôt qu'à part : la maintenance se consulte à chaque
      // lecture d'état, et un aller-retour de plus par question se paierait cher.
      gameClosed: sql<number>`coalesce((select ${settings.maintenanceSince} is not null
        from ${settings} where ${settings.id} = 1), 0)`,
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
    // Lu au deck plutôt que recompté ici : c'est une constante entre deux
    // éditions de l'administration. Voir server/utils/deck.ts.
    floorTotal: await floorSize(db, row.user.currentFloor, now),
    attemptSeen: row.attemptSeen,
    gameClosed: row.gameClosed === 1,
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
  snapshot: PlayerSnapshot,
  reservation: Reservation,
  answer: string,
  now: Date,
  source: AnswerSource = 'player',
): Promise<Resolution> {
  // Le joueur vient du snapshot de l'appelant, chargé dans le même aller-retour
  // que la réservation : le relire ici coûterait un hop pour la même ligne.
  const { user } = snapshot
  const rules = rulesForFloor(user.currentFloor)
  const judgement = judgeAnswer({
    user,
    reservation,
    acceptedAnswers: await acceptedFor(db, reservation.questionId),
    answer,
    source,
    rules,
  }, now)
  const { correct } = judgement

  // Le coffre se grave ici, une fois pour toutes : une contestation acceptée
  // rendra peut-être la question juste plus tard, sans faire naître de coffre.
  // Voir specs/bonus.md#contestation.
  const chest: ChestState | null = correct && servesLoot(snapshot, reservation, rules) ? 'closed' : null

  await db
    .update(reservations)
    .set({ resolvedAt: now, correct, submittedAnswer: answer, chest })
    .where(eq(reservations.userId, user.id))

  const resolved: Reservation = {
    ...reservation,
    resolvedAt: now,
    correct,
    submittedAnswer: answer,
    chest,
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
      // L'heure du jeu, pas celle de la base : c'est elle qui dit si l'erreur
      // appartient à la tentative en cours.
      seenAt: now,
      // Gardé au-delà de la réservation : c'est la pièce qu'une contestation
      // soumet à l'admin. Voir specs/validation.md#contestation.
      submittedAnswer: answer,
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
  rules: FloorRules,
  lootQuestion: boolean,
): ServedQuestion {
  return {
    id: reservation.questionId,
    statement,
    expiresAt: reservation.expiresAt.toISOString(),
    focusGraceMs: rules.focusGraceMs,
    lootQuestion,
  }
}

/** Le coffre d'une réservation, tel que l'écran le lit. Null quand il n'y en a pas. */
function chestOf(reservation: Reservation): ChestView | null {
  const { chest } = reservation

  if (chest === null) {
    return null
  }

  if (chest === 'closed') {
    return { opened: false, mimic: false, spell: null }
  }

  if (chest === 'mimic') {
    return { opened: true, mimic: true, spell: null }
  }

  return { opened: true, mimic: false, spell: chest }
}

/**
 * Le statut loot de la question réservée : elle occupera le rang suivant dans les
 * questions vues de l'étage. La même formule sert à l'annoncer au joueur et à
 * graver son coffre — un seul endroit décide.
 */
function servesLoot(snapshot: PlayerSnapshot, reservation: Reservation, rules: FloorRules): boolean {
  return isLootQuestion({
    position: snapshot.seen + 1,
    floorTotal: snapshot.floorTotal,
    mode: reservation.mode,
  }, rules)
}


/**
 * Derives the phase from a snapshot. The only query it may still make is the
 * recovery tally, and only when the player has no lives left: a recovery run
 * cannot exist otherwise — it is created with the lives at zero and cleared when
 * they come back.
 */
async function stateFrom(db: Database, snapshot: PlayerSnapshot, now: Date): Promise<GameState> {
  const { user, reservation, question, seen } = snapshot

  const base = {
    floor: user.currentFloor,
    lives: user.lives,
    started: seen > 0 || reservation !== undefined,
    question: null as ServedQuestion | null,
    verdict: null as Verdict | null,
    cooldownUntil: user.cooldownUntil?.toISOString() ?? null,
    recovery: user.lives <= 0 ? await recoveryProgress(db, user) : null,
    recoveryResult: null as 'resumed' | 'failed' | null,
    floorSeen: seen,
    floorTotal: snapshot.floorTotal,
    attemptSeen: snapshot.attemptSeen,
    chest: null as ChestView | null,
    maintenance: snapshot.gameClosed && !user.isAdmin,
  }

  if (reservation && question) {
    const rules = rulesForFloor(user.currentFloor)

    // The verdict is carried whatever the phase: the question that took the last
    // life is precisely the one whose answer the player still has to read.
    if (reservation.resolvedAt) {
      base.verdict = {
        questionId: reservation.questionId,
        correct: reservation.correct ?? false,
        answerLabel: question.answerLabel,
        submittedAnswer: reservation.submittedAnswer ?? '',
        // Le rattrapage ne coûte aucune vie : seule une erreur d'ascension en
        // fait perdre une.
        lifeLost: reservation.mode === 'ascent' && !reservation.correct,
      }
      base.chest = chestOf(reservation)
    }
    else {
      // La question en jeu n'est pas encore résolue : c'est le rang suivant
      // qu'elle occupera dans les questions vues de l'étage.
      base.question = servedQuestion(
        reservation,
        question.statement,
        rules,
        servesLoot(snapshot, reservation, rules),
      )
    }
  }

  // Un verdict encore à l'écran ne retient pas le joueur à l'étage : il se lit
  // aussi bien sur le palier ou sur l'attente qui suivent.
  const phase = phaseOfSnapshot(snapshot, holdsQuestion(snapshot), now)

  // Rien du jeu n'est servi pendant l'attente : le pool se lit à part, comme la
  // fiche de révision qu'il est censé être.
  return { ...base, phase, question: phase === 'cooldown' ? null : base.question }
}

async function buildState(db: Database, userId: number, now: Date): Promise<GameState> {
  return stateFrom(db, await loadSnapshot(db, userId, now), now)
}

/**
 * Where the player stands. Reading draws no question and starts no clock: it hands
 * back the live reservation, the verdict waiting to be read, or — for a reservation
 * whose deadline has passed — resolves it as the failure it already is.
 */
export async function readGameState(db: Database, user: User, now: Date): Promise<GameState> {
  const snapshot = await loadSnapshot(db, user.id, now)
  const { reservation } = snapshot

  // Same grace as an answer gets: a read landing a hair after the deadline must
  // not close a question whose answer is still in flight.
  const expired = reservation !== undefined
    && !reservation.resolvedAt
    && isExpiredForUser(reservation, snapshot.user, now)

  if (expired) {
    const resolution = await resolve(db, snapshot, reservation, '', now)

    // Rien d'autre n'a bougé : l'attente ne peut pas s'achever dans la seconde où
    // elle démarre. On rend ce qui vient d'être écrit.
    return stateFrom(db, {
      ...snapshot,
      user: resolution.user,
      reservation: resolution.reservation,
      seen: snapshot.seen + resolution.seenDelta,
      attemptSeen: snapshot.attemptSeen + resolution.seenDelta,
    }, now)
  }

  // Une attente qui vient de s'achever est le seul cas où une lecture a quelque
  // chose à écrire. Un palier ou une fin de partie n'en font pas partie : il n'y
  // a plus de vies à y rendre.
  const waitOver = phaseOfSnapshot(snapshot, false, now) === 'recovery'

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

  // Les vies pleines ouvrent une tentative : ce qui a été raté avant n'est plus
  // contestable. Voir specs/validation.md#contestation.
  await closeAttempt(db, user, now)
  await db
    .update(users)
    .set({ lives: rules.lives, cooldownUntil: null, attemptStartedAt: now })
    .where(eq(users.id, user.id))
}

/**
 * The player's own move: resolve whatever verdict they were reading, then reserve a
 * question drawn at random among those they have not seen on this floor.
 */
export async function serveNextQuestion(db: Database, user: User, now: Date): Promise<GameState> {
  const snapshot = await loadSnapshot(db, user.id, now)
  const { reservation } = snapshot
  // Le snapshot décrit fidèlement le joueur tant que rien n'a été résolu ici.
  let fresh = snapshot.user
  let seenDelta = 0

  // Le jeu est fermé : plus aucune question n'est servie. Ce qui est commencé se
  // finit par d'autres chemins — répondre et ouvrir son coffre restent permis, et
  // le verdict se lit. Voir specs/admin.md#maintenance.
  if (snapshot.gameClosed && !snapshot.user.isAdmin) {
    return stateFrom(db, snapshot, now)
  }

  // Un coffre encore fermé retient le joueur : passer par-dessus lui ferait
  // perdre l'objet, et le clic « suivant » est justement celui dont l'ouverture
  // doit se distinguer. Voir specs/bonus.md#coffre-et-mimic.
  if (reservation?.chest === 'closed') {
    return stateFrom(db, snapshot, now)
  }

  if (reservation && !reservation.resolvedAt) {
    // A live reservation is not replaced: fleeing a question costs what a wrong
    // answer costs. An expired one resolves first, then the next is drawn.
    if (!isExpiredForUser(reservation, snapshot.user, now)) {
      return stateFrom(db, snapshot, now)
    }

    const resolution = await resolve(db, snapshot, reservation, '', now)
    fresh = resolution.user
    seenDelta = resolution.seenDelta
  }

  // Une résolution juste au-dessus a pu ajouter une question vue — jamais en
  // rattrapage, d'où le delta rendu par resolve() plutôt qu'un « +1 » supposé.
  const current: PlayerSnapshot = { ...snapshot, user: fresh, seen: snapshot.seen + seenDelta, attemptSeen: snapshot.attemptSeen + seenDelta }

  // Le joueur vient de cliquer : plus aucune question n'est en jeu, celle qu'il
  // tenait est résolue.
  const phase = phaseOfSnapshot(current, false, now)

  // La tour est finie : phase terminale, rien à tirer, rien à franchir.
  if (phase === 'gameOver') {
    return stateFrom(db, current, now)
  }

  if (phase === 'floorEnd') {
    await crossFloor(db, fresh, now)

    // L'étage a changé, donc le décompte des questions vues et le total de
    // l'étage avec lui : on relit plutôt que de rapiécer un instantané qui ne
    // décrit plus le joueur. Cinq fois par partie, pas par question.
    return buildState(db, user.id, now)
  }

  if (fresh.lives <= 0) {
    return advanceRecovery(db, fresh, now)
  }

  const drawn = await drawAndReserve(db, fresh, now)

  if (!drawn) {
    // L'étage se compte des questions non vues qu'il n'a plus : le deck a bougé
    // sous le joueur. On efface le verdict qu'il vient de lire et on rend l'état
    // tel qu'il est — inventer un palier ici le ferait monter sans avoir joué.
    await db.delete(reservations).where(eq(reservations.userId, user.id))
    return buildState(db, user.id, now)
  }

  // L'état renvoyé est exactement ce qu'on vient d'écrire : le relire coûterait
  // deux allers-retours de plus pour la même réponse.
  return stateFrom(db, {
    ...current,
    reservation: {
      userId: user.id,
      questionId: drawn.question.id,
      mode: 'ascent',
      expiresAt: drawn.expiresAt,
      createdAt: now,
      resolvedAt: null,
      correct: null,
      submittedAnswer: null,
      chest: null,
    },
    question: drawn.question,
  }, now)
}

/**
 * Le joueur ouvre son coffre. Le dé est jeté ici, une seule fois, et son résultat
 * est gravé sur la réservation : tiré à la question, le joueur en connaîtrait le
 * contenu avant de répondre ; non gravé, un rechargement le rejouerait.
 *
 * Une ouverture sans coffre, ou sur un coffre déjà ouvert, est ignorée — l'appareil
 * qui l'a envoyée est en retard, pas fautif.
 */
export async function openPlayerChest(
  db: Database,
  user: User,
  now: Date,
  random: () => number = Math.random,
): Promise<GameState> {
  const snapshot = await loadSnapshot(db, user.id, now)
  const { reservation } = snapshot
  const rules = rulesForFloor(snapshot.user.currentFloor)

  if (!reservation || reservation.chest !== 'closed') {
    return stateFrom(db, snapshot, now)
  }

  const outcome = rollChest(rules, random)
  const chest: ChestState = outcome.spell ?? 'mimic'

  // Le coffre se réclame et se remplit d'un seul geste : deux ouvertures
  // simultanées jetteraient deux dés, et la seconde écraserait la première —
  // un sort de plus à l'inventaire, ou un Mimic par-dessus.
  const [claimed] = await db
    .update(reservations)
    .set({ chest })
    .where(and(eq(reservations.userId, user.id), eq(reservations.chest, 'closed')))
    .returning()

  if (!claimed) {
    // Un autre appel l'a ouvert entre-temps : ce dé-ci ne compte pas.
    return buildState(db, user.id, now)
  }

  if (outcome.spell) {
    // Une ligne par exemplaire : le tirage ignore le stock, les doublons sont
    // illimités.
    await db.insert(inventory).values({ userId: user.id, spell: outcome.spell, obtainedAt: now })
  }

  const opened: Reservation = { ...reservation, chest }

  if (!outcome.mimic) {
    return stateFrom(db, { ...snapshot, reservation: opened }, now)
  }

  // Le Mimic retire toutes les vies d'un coup, traité comme une perte de dernière
  // vie ordinaire : l'attente démarre, et le verdict de la question — juste, elle
  // l'était — reste lisible par-dessus.
  const cooldownUntil = cooldownFrom(rules, now)

  await db.update(users).set({ lives: 0, cooldownUntil }).where(eq(users.id, user.id))

  return stateFrom(db, {
    ...snapshot,
    user: { ...snapshot.user, lives: 0, cooldownUntil },
    reservation: opened,
  }, now)
}

/**
 * Franchir le palier : l'étage monte d'un cran, le Pool Échecs de celui qu'on
 * quitte est abandonné — les ratées non rattrapées ne suivent pas le joueur — et
 * la question qu'il tenait reste en bas avec son verdict.
 * Appelée sur la phase `floorEnd`, qui garantit qu'un étage suivant existe.
 * Voir specs/mecanique.md#fin-détage.
 */
async function crossFloor(db: Database, user: User, now: Date): Promise<void> {
  const currentFloor = user.currentFloor + 1

  // Franchir est un seul acte : en trois écritures séparées, une interruption
  // au milieu abandonnerait le Pool Échecs d'un étage que le joueur n'a pas
  // quitté. Un batch plutôt qu'une transaction : sur Turso, le HTTP n'en porte
  // pas.
  await db.batch([
    db.delete(reservations).where(eq(reservations.userId, user.id)),
    db
      .delete(missedPool)
      .where(and(eq(missedPool.userId, user.id), eq(missedPool.floor, user.currentFloor))),
    db.update(users).set({ currentFloor }).where(eq(users.id, user.id)),
  ])

  // Sans vie, on ne réserve rien : l'attente gagnée à l'étage d'en dessous
  // attend le joueur au nouveau, et un chrono qui tournerait pendant cette
  // attente lui coûterait une vie qu'il n'a pas.
  if (user.lives > 0) {
    // Étage neuf : le curseur repart de zéro, donc la première question de
    // l'étage est la première de rang supérieur à 0.
    await drawAndReserve(db, { ...user, currentFloor, floorCursor: 0 }, now)
  }
}

/** Ce qu'un tirage vient d'écrire, pour éviter d'aller le relire. */
interface DrawnQuestion {
  question: Question
  expiresAt: Date
}

/**
 * Sert la question suivante du deck : la première de l'étage dont le rang dépasse
 * le curseur du joueur. Un saut dans l'index, **une ligne lue**, quel que soit le
 * nombre de questions que l'étage contient.
 *
 * Rend null quand l'étage est épuisé — c'est ce qui fait le palier.
 */
async function drawAndReserve(db: Database, user: User, now: Date): Promise<DrawnQuestion | null> {
  const [question] = await db
    .select()
    .from(questions)
    .where(and(eq(questions.floor, user.currentFloor), gt(questions.rank, user.floorCursor)))
    .orderBy(asc(questions.rank))
    .limit(1)

  if (!question) {
    return null
  }

  const expiresAt = new Date(now.getTime() + rulesForFloor(user.currentFloor).ascentTimerMs)

  // Le curseur avance avec la question servie. C'est lui qui porte la place du
  // joueur dans le deck, et non sa réservation : un rattrapage écrase celle-ci
  // avec une question du Pool Échecs, dont le rang n'a rien à voir.
  await db.update(users).set({ floorCursor: question.rank }).where(eq(users.id, user.id))
  await reserve(db, user.id, question.id, 'ascent', expiresAt, now)

  return { question, expiresAt }
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
    chest: null,
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

  // La tentative ne se clôt qu'au moment où la suivante s'ouvre : une attente de
  // plus prolonge celle qui court.
  if (verdict.resumes) {
    await closeAttempt(db, user, now)
  }

  await db
    .update(users)
    .set({
      lives: verdict.livesAfter,
      cooldownUntil: verdict.cooldownUntil,
      // Une reprise ouvre une tentative ; une attente de plus la prolonge.
      attemptStartedAt: verdict.resumes ? now : user.attemptStartedAt,
    })
    .where(eq(users.id, user.id))

  // Le verdict du rattrapage se lit sur un écran à part, pas sur la dernière
  // question : il voyage avec l'état jusqu'à ce que le joueur reprenne.
  return { ...await buildState(db, user.id, now), recoveryResult: verdict.resumes ? 'resumed' : 'failed' }
}

export interface MissedPoolEntryView {
  questionId: string
  statement: string
  /** Shown here on purpose: the wait screen is a revision sheet, not a punishment. */
  answerLabel: string
  /** What the player answered — justifies contesting. Null on timeout. */
  submittedAnswer: string | null
  poolSuccesses: number
  lastFailedAt: string
  /** Statut de la contestation : none si pas disputée, pending en attente d'arbitrage, rejected si refusée. */
  disputeStatus: 'none' | 'pending' | 'rejected'
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
      submittedAnswer: seenQuestions.submittedAnswer,
      poolSuccesses: missedPool.poolSuccesses,
      lastFailedAt: missedPool.lastFailedAt,
      disputeStatus: disputes.status,
    })
    .from(missedPool)
    .innerJoin(questions, eq(questions.id, missedPool.questionId))
    .leftJoin(seenQuestions, and(
      eq(seenQuestions.userId, missedPool.userId),
      eq(seenQuestions.questionId, missedPool.questionId),
    ))
    .leftJoin(disputes, and(
      eq(disputes.userId, missedPool.userId),
      eq(disputes.questionId, missedPool.questionId),
    ))
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
    entries: rows.map((row) => {
      const disputeStatus: MissedPoolEntryView['disputeStatus']
        = row.disputeStatus === 'pending' ? 'pending'
          : row.disputeStatus === 'rejected' ? 'rejected' : 'none'

      return {
        questionId: row.questionId,
        statement: row.statement,
        answerLabel: row.answerLabel,
        submittedAnswer: row.submittedAnswer,
        poolSuccesses: row.poolSuccesses,
        lastFailedAt: row.lastFailedAt.toISOString(),
        disputeStatus,
      }
    }),
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
  source: AnswerSource = 'player',
): Promise<GameState> {
  const snapshot = await loadSnapshot(db, user.id, now)
  const { reservation } = snapshot

  if (!reservation || reservation.resolvedAt) {
    // Rien à résoudre : l'appareil qui a envoyé ça est en retard, pas fautif.
    return stateFrom(db, snapshot, now)
  }

  if (source === 'focusLoss') {
    // La sanction est de perdre la main sur la question — la réponse part en
    // l'état, bonne ou vide — et d'être marqué pour l'administration.
    // Voir specs/anti-triche.md#perte-de-focus.
    await db.insert(focusLosses).values({
      userId: user.id,
      questionId: reservation.questionId,
      mode: reservation.mode,
      lostAt: now,
    })
  }

  const resolution = await resolve(db, snapshot, reservation, answer, now, source)

  return stateFrom(db, {
    ...snapshot,
    user: resolution.user,
    reservation: resolution.reservation,
    seen: snapshot.seen + resolution.seenDelta,
    attemptSeen: snapshot.attemptSeen + resolution.seenDelta,
  }, now)
}
