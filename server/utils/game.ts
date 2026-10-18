import { and, asc, count, desc, eq, inArray, isNull, sql } from 'drizzle-orm'
import type { BatchItem, BatchResponse } from 'drizzle-orm/batch'
import type { RunnableQuery } from 'drizzle-orm/runnable-query'
import {
  canDrawRecovery,
  cooldownFields,
  cooldownFrom,
  isExpired,
  isLootQuestion,
  judgeAnswer,
  judgeRecovery,
  movePoolCounter,
  phaseOf,
  recoveryThreshold,
  rollChest,
  resumesRecovery,
  sealedRecovery,
} from './mechanics'
import {
  claimFirstAscent,
  earnedByAnswer,
  earnedByCrossing,
  earnedByFloorDone,
  playedToday,
  unlock,
} from './achievements'
import { floorSizeQuery, nextQuestionQuery, sizeOf, upcomingQuestions } from './deck'
import { closeAttempt, openAttempt } from './journey'
import { effectsQuery, toEffectViews } from './effects'
import { isCooldownBound } from '../../shared/utils/spells'
import { rulesForFloor } from './rules'
import { rulesWithEffects, SPELLS } from './spellbook'
import {
  acceptedAnswers,
  deckFloors,
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
import type { EffectStake, EffectView, PlacedEffect } from './effects'
import type { AchievementId } from '../../shared/utils/achievements'
import type { AnswerSource, Phase } from './mechanics'
import type { FloorRules } from './rules'
import type { ChestState, SpellId } from '../../shared/utils/spells'
import type { Database } from '../db/client'
import type { MissedPoolEntry, Question, RecoveryQuestion, Reservation, User } from '../db/schema'

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
  /** Rappelée sur l'écran de résultat : le joueur ne se souvient pas forcément
   *  de l'énoncé le temps de lire son verdict. */
  statement: string
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
  /** Whether the verdict is already locked in: quota reached (success) or
   *  mathematically impossible to reach it with the remaining questions (failure).
   *  The recovery stops right here — the remaining questions are not played.
   *  See specs/mecanique.md#déroulement-du-rattrapage. */
  sealed: boolean
  /** Whether finishing on this tally gives the lives back. */
  resumes: boolean
  /**
   * Les bonnes réponses que ce rattrapage exige, déjà bornées aux questions
   * tirées : le joueur lit ici ce qu'il lui faut, Indulgence noire comprise.
   */
  required: number
}

export interface GameState {
  phase: Phase
  floor: number
  lives: number
  /** Les vies pleines pour la tentative en cours, Vitalité comprise : ce que
   *  l'écran compare à `lives` pour montrer les vies déjà perdues. */
  maxLives: number
  question: ServedQuestion | null
  verdict: Verdict | null
  /** ISO 8601 end of the cooldown, null outside a cooldown. */
  cooldownUntil: string | null
  /** Tally of the recovery under way, null outside one. */
  recovery: RecoveryProgress | null
  /** Questions vues à l'étage courant. */
  floorSeen: number
  /** Questions que l'étage courant contient. */
  floorTotal: number
  /** Questions vues depuis le début de la tentative en cours. */
  attemptSeen: number
  /**
   * Questions vues depuis la dernière remise à zéro : ce que relit l'onglet
   * Toutes du Volumen. À zéro, le camp ne montre pas son parchemin.
   */
  seenTotal: number
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
  /**
   * Les Sorts posés sur le joueur : ceux qui attendent sa prochaine tentative,
   * que l'écran d'attente récapitule, et ceux ancrés sur celle qu'il joue, dont
   * l'ascension affiche une icône. Voir specs/bonus.md#écrans.
   */
  effects: EffectView[]
  /**
   * Les succès que **cette requête** vient d'écrire, et rien d'autre : partout
   * ailleurs le tableau est vide. C'est ce qui empêche l'annonce de se rejouer —
   * un rechargement ou une relecture n'écrit rien, donc n'annonce rien, sans
   * qu'aucune garde n'ait à s'en souvenir. Voir specs/succes.md#affichage.
   */
  unlocked: AchievementId[]
}

/**
 * Everything the phase is derived from, in as few round trips as possible.
 *
 * The database is remote and every query is a network hop, so this is deliberately
 * one of them rather than one per fact: every read keys on the player's id, so they
 * all travel in a single batch, and the reservation brings its question along.
 */
export interface PlayerSnapshot {
  user: User
  /** Le jeu est fermé par l'administration. Vrai pour tout le monde, admins compris. */
  gameClosed: boolean
  /** Questions the current floor holds. */
  floorTotal: number
  /** Les Sorts posés sur le joueur, morts exclus. Lus avec la réservation. */
  effects: PlacedEffect[]
  reservation?: Reservation
  /** The reserved question, loaded with the reservation. */
  question?: Question
  /** Le tirage du rattrapage en cours, vide hors rattrapage. Lu dans le même lot. */
  recoveryRun: RecoveryQuestion[]
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
    seen: snapshot.user.floorSeen,
    floorTotal: snapshot.floorTotal,
  }, now)
}

/**
 * Les règles telles que ce joueur les joue : celles de son étage, modulées par
 * les effets ancrés sur la tentative qu'il est en train de jouer.
 *
 * Les effets viennent de l'instantané, chargés dans le même lot que sa
 * réservation : une règle modulée ne coûte donc aucune lecture de plus.
 *
 * Deux familles comptent, et deux seulement : ce qui est ancré sur la tentative
 * en cours — Chronomancie, sur chaque question — et ce qui est lié à l'attente
 * où le joueur se tient, qui trouve son déclencheur maintenant. Ce qui attend la
 * prochaine tentative ne module pas celle-ci.
 * Voir specs/bonus.md#ancrage-et-durée-de-vie.
 */
function playedRules(snapshot: PlayerSnapshot, floor = snapshot.user.currentFloor): FloorRules {
  return rulesWithEffects(
    rulesForFloor(floor),
    // Les sorts liés à l'attente sont déjà bornés à celle du joueur : ce module
    // ne sert que ceux-là. Voir server/utils/mechanics.ts#isBorneBy.
    snapshot.effects.filter(effect => effect.state === 'active' || isCooldownBound(effect.spell)),
  )
}

/** Une question encore en jeu, c'est-à-dire réservée et non résolue. */
function holdsQuestion(snapshot: PlayerSnapshot): boolean {
  return snapshot.reservation !== undefined && snapshot.reservation.resolvedAt === null
}

/**
 * Les lectures d'un instantané, rendues plutôt qu'exécutées : toutes partent du
 * seul identifiant du joueur, donc elles voyagent dans un seul lot — un
 * aller-retour réseau — et chaque action y ajoute ce qu'elle seule lira.
 * Voir tests/server/query-budget.test.ts.
 */
function snapshotQueries(db: Database, userId: number) {
  return [
    db
      .select({
        user: users,
        // Lu avec le joueur plutôt qu'à part : la maintenance se consulte à chaque
        // lecture d'état, et un aller-retour de plus par question se paierait cher.
        gameClosed: sql<number>`coalesce((select ${settings.maintenanceSince} is not null
          from ${settings} where ${settings.id} = 1), 0)`,
        // Lue au deck plutôt que comptée : une ligne, quel que soit l'étage. Et
        // lue à l'étage que porte la ligne du joueur, sans attendre de l'avoir
        // lue. Voir server/utils/deck.ts.
        floorTotal: sql<number>`coalesce((select ${deckFloors.total} from ${deckFloors}
          where ${deckFloors.floor} = ${users.currentFloor}), 0)`,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1),
    db
      .select({ reservation: reservations, question: questions })
      .from(reservations)
      .innerJoin(questions, eq(questions.id, reservations.questionId))
      .where(eq(reservations.userId, userId))
      .limit(1),
    effectsQuery(db, userId),
    // Vide hors rattrapage, et c'est le cas presque toujours : une ligne d'index
    // regardée pour rien, contre un aller-retour à chaque question sans vie.
    db
      .select()
      .from(recoveryQuestions)
      .where(eq(recoveryQuestions.userId, userId))
      .orderBy(recoveryQuestions.position),
  ] as const
}

type SnapshotQueries = ReturnType<typeof snapshotQueries>

function toSnapshot([[row], [held], effects, recoveryRun]: BatchResponse<SnapshotQueries>): PlayerSnapshot {
  return {
    // Le joueur porte ses deux décomptes de questions vues, il ne les compte
    // plus : les compter coûtait une ligne par question déjà vue, à chaque
    // lecture d'état. Voir server/db/schema.ts.
    user: row.user,
    effects: toEffectViews(effects, row.user),
    floorTotal: row.floorTotal,
    gameClosed: row.gameClosed === 1,
    reservation: held?.reservation,
    question: held?.question,
    recoveryRun,
  }
}

async function loadSnapshot(db: Database, userId: number): Promise<PlayerSnapshot> {
  return toSnapshot(await db.batch(snapshotQueries(db, userId)))
}

/**
 * Les libellés acceptés de la question tenue, désignée par la réservation
 * elle-même : la lecture part dans le lot de l'instantané, et juger la réponse
 * ne coûte plus d'aller-retour à part.
 */
function acceptedQuery(db: Database, userId: number) {
  return db
    .select({ text: acceptedAnswers.text })
    .from(acceptedAnswers)
    .where(inArray(
      acceptedAnswers.questionId,
      db.select({ questionId: reservations.questionId }).from(reservations).where(eq(reservations.userId, userId)),
    ))
}

/** Recolle à un état ce que la requête vient de débloquer, sans toucher au reste. */
function withUnlocked(state: GameState, unlocked: AchievementId[]): GameState {
  return unlocked.length ? { ...state, unlocked } : state
}

/** Ce que earnedByAnswer réclame, prélevé sur l'instantané du joueur qui vient de répondre. */
function answeredAchievements(
  user: Pick<User, 'streak' | 'seenTotal' | 'daysPlayed' | 'playStreak'>,
  correct: boolean,
  empty: boolean,
  died: boolean,
): AchievementId[] {
  return earnedByAnswer({
    correct,
    empty,
    died,
    streak: user.streak,
    seenTotal: user.seenTotal,
    daysPlayed: user.daysPlayed,
    playStreak: user.playStreak,
  })
}

async function poolSize(db: Database, user: User): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(missedPool)
    .where(and(eq(missedPool.userId, user.id), eq(missedPool.floor, user.currentFloor)))

  return row.value
}

/** Un rattrapage est tiré : ses questions n'existent que tant qu'il est en cours. */
export async function hasRecoveryRun(db: Database, userId: number): Promise<boolean> {
  const [row] = await db
    .select({ value: count() })
    .from(recoveryQuestions)
    .where(eq(recoveryQuestions.userId, userId))

  return row.value > 0
}

/**
 * The tally of the recovery under way, or null when none is.
 *
 * Les règles viennent de l'appelant, et ce sont celles que le joueur **joue** :
 * le seuil de reprise n'est pas celui de l'étage dès qu'une Indulgence noire est
 * posée. Voir specs/bonus.md#catalogue.
 */
function recoveryProgress(drawn: RecoveryQuestion[], rules: FloorRules): RecoveryProgress | null {
  if (!drawn.length) {
    return null
  }

  const played = drawn.filter(row => row.correct !== null)
  const successes = played.filter(row => row.correct).length

  return {
    total: drawn.length,
    played: played.length,
    successes,
    // Le seuil se lit dans les règles **jouées** : une Indulgence noire exige un
    // perfect, et c'est ici que le joueur le lit avant de finir.
    // Voir specs/bonus.md#catalogue.
    resumes: resumesRecovery(successes, drawn.length, rules),
    sealed: sealedRecovery(successes, played.length, drawn.length, rules),
    required: recoveryThreshold(drawn.length, rules),
  }
}

/**
 * A recovery answer costs no life and moves no progress: the question was already
 * seen. What it moves is the question's own counter — up on a right answer, back to
 * zero on a wrong one, out of the pool once the threshold is reached.
 * See specs/mecanique.md#pool-échecs.
 *
 * Rend les écritures plutôt que de les jouer : elles partent dans le lot de la
 * résolution, et un rattrapage interrompu ne laisse pas une question jouée dont
 * le compteur n'a pas bougé.
 */
function recoveryWrites(
  db: Database,
  user: User,
  questionId: string,
  correct: boolean,
  poolEntry: MissedPoolEntry | undefined,
  now: Date,
): { writes: BatchItem<'sqlite'>[], leavesPool: boolean } {
  const writes: BatchItem<'sqlite'>[] = [
    db
      .update(recoveryQuestions)
      .set({ correct })
      .where(and(
        eq(recoveryQuestions.userId, user.id),
        eq(recoveryQuestions.questionId, questionId),
      )),
  ]

  if (!poolEntry) {
    return { writes, leavesPool: false }
  }

  const membership = and(
    eq(missedPool.userId, user.id),
    eq(missedPool.questionId, questionId),
  )
  const move = movePoolCounter(poolEntry, correct, rulesForFloor(user.currentFloor), now)

  if (move.leaves) {
    writes.push(db.delete(missedPool).where(membership))
    return { writes, leavesPool: true }
  }

  writes.push(db
    .update(missedPool)
    .set({ poolSuccesses: move.poolSuccesses, lastFailedAt: move.lastFailedAt })
    .where(membership))

  return { writes, leavesPool: false }
}

/**
 * Ce qu'une réservation expirée accepte : rien. Le chrono tombé la juge fausse
 * quoi qu'on y lise (voir judgeAnswer), donc ses libellés ne valent pas un
 * aller-retour.
 */
const NOTHING_ACCEPTED: string[] = []

/** La même question, lue à travers les règles de l'étage où se tient le joueur. */
function isExpiredForUser(reservation: Reservation, user: User, now: Date): boolean {
  return isExpired(reservation.expiresAt, rulesForFloor(user.currentFloor), now)
}

/** Ce que la résolution vient d'écrire, pour éviter d'aller le relire. */
interface Resolution {
  /** L'instantané tel que la résolution l'a laissé : joueur, réservation, tirage. */
  snapshot: PlayerSnapshot
  /** Les succès que cette résolution a réellement gravés. Voir specs/succes.md. */
  unlocked: AchievementId[]
}

/**
 * Records the outcome of a reservation: the question becomes seen, a failure costs
 * a life and joins the missed pool, and losing the last life starts the cooldown.
 *
 * Returns the rows as it left them: the caller rebuilds the state from those rather
 * than paying a round trip to read back what it just wrote.
 *
 * Toutes les écritures partent dans un seul lot : un aller-retour, et une
 * interruption au milieu ne laisse pas une réservation résolue sans sa question
 * vue. Les libellés acceptés viennent de l'appelant, lus avec son instantané.
 */
async function resolve(
  db: Database,
  snapshot: PlayerSnapshot,
  reservation: Reservation,
  answer: string,
  now: Date,
  source: AnswerSource,
  accepted: string[],
): Promise<Resolution> {
  // Le joueur vient du snapshot de l'appelant, chargé dans le même aller-retour
  // que la réservation : le relire ici coûterait un hop pour la même ligne.
  const { user } = snapshot
  const rules = rulesForFloor(user.currentFloor)
  const judgement = judgeAnswer({
    user,
    reservation,
    acceptedAnswers: accepted,
    answer,
    source,
    rules,
  }, now)
  const { correct } = judgement

  // Le coffre se grave ici, une fois pour toutes : une contestation acceptée
  // rendra peut-être la question juste plus tard, sans faire naître de coffre.
  // Voir specs/bonus.md#contestation.
  const chest: ChestState | null = correct && servesLoot(snapshot, reservation, rules) ? 'closed' : null

  const resolveReservation = db
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

  // Le jour joué s'estampille pour toute question résolue, rattrapage compris :
  // une journée passée entièrement à rattraper est une journée jouée. Rend null
  // quand le joueur a déjà joué aujourd'hui, et il n'y a alors rien à écrire.
  // Voir specs/succes.md#assiduité.
  const played = playedToday(user, now)

  if (reservation.mode === 'recovery') {
    // Aucune vie perdue, aucune progression : le rattrapage ne joue que sur les
    // compteurs du Pool Échecs. Les compteurs de progression passent donc
    // inchangés — ce qu'ils portaient déjà est de toute façon déjà acquis.
    // Lue ici et pas avec l'instantané : seul un rattrapage s'en sert, et le
    // lot de chaque réponse d'ascension la paierait pour rien.
    const [poolEntry] = await db
      .select()
      .from(missedPool)
      .where(and(eq(missedPool.userId, user.id), eq(missedPool.questionId, reservation.questionId)))
      .limit(1)
    const { writes, leavesPool } = recoveryWrites(db, user, reservation.questionId, correct, poolEntry, now)
    const recovering: User = { ...user, ...played }

    await db.batch([
      resolveReservation,
      ...writes,
      ...played ? [db.update(users).set(played).where(eq(users.id, user.id))] : [],
    ])

    const earned = [
      ...answeredAchievements(recovering, correct, answer === '', false),
      ...leavesPool ? ['POOL_CLEARED' as const] : [],
    ]

    return {
      snapshot: {
        ...snapshot,
        user: recovering,
        reservation: resolved,
        // Le tirage tel que l'écriture ci-dessus l'a laissé, sans aller le relire.
        recoveryRun: snapshot.recoveryRun.map(entry =>
          entry.questionId === reservation.questionId ? { ...entry, correct } : entry),
      },
      unlocked: await unlock(db, snapshot.user, earned, now),
    }
  }

  const { seenDelta, entersPool, livesAfter: lives, cooldownUntil } = judgement

  const markSeen = db
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

  // Les compteurs de questions vues bougent dans le même lot que la question
  // vue elle-même, et la vie perdue avec eux : écrits à part, une interruption
  // au milieu laisserait le joueur avec un décompte qui ne décrit plus sa
  // partie. Voir server/db/schema.ts.
  const moved: Partial<User> = entersPool ? { lives, ...cooldownFields(cooldownUntil, now) } : {}

  // La série se casse sur l'erreur et repart de la bonne réponse. C'est elle qui
  // portera le sans-faute de l'étage, d'où sa place dans le même lot que la
  // question vue : les deux ne peuvent pas se désaccorder.
  const counted = {
    seenTotal: user.seenTotal + seenDelta,
    streak: correct ? user.streak + 1 : 0,
  }

  const patch = { ...moved, ...played, ...counted }

  const advance = db
    .update(users)
    .set({
      ...patch,
      floorSeen: sql`${users.floorSeen} + ${seenDelta}`,
      attemptSeen: sql`${users.attemptSeen} + ${seenDelta}`,
    })
    .where(eq(users.id, user.id))

  const fresh: User = {
    ...user,
    ...patch,
    floorSeen: user.floorSeen + seenDelta,
    attemptSeen: user.attemptSeen + seenDelta,
  }

  // L'étage s'achève sur la question qui le complète, et c'est là que son
  // sans-faute et la fin de la tour se gagnent — pas au clic qui franchit le
  // palier. Au dernier étage il n'y a plus de clic : `gameOver` ne porte aucune
  // action, personne ne repasse. Voir utils/phase.ts.
  const floorDone = fresh.floorSeen >= snapshot.floorTotal

  const earned = [
    ...answeredAchievements(fresh, correct, answer === '', cooldownUntil !== null),
    ...floorDone
      ? earnedByFloorDone({
          floor: user.currentFloor,
          floorTotal: snapshot.floorTotal,
          streak: fresh.streak,
        })
      : [],
  ]

  await db.batch([
    resolveReservation,
    markSeen,
    ...entersPool
      ? [db
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
          })]
      : [],
    advance,
  ])

  return {
    snapshot: { ...snapshot, user: fresh, reservation: resolved },
    unlocked: await unlock(db, snapshot.user, earned, now),
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
    position: snapshot.user.floorSeen + 1,
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
function stateFrom(snapshot: PlayerSnapshot, now: Date): GameState {
  const { user, reservation, question } = snapshot
  const seen = user.floorSeen
  const played = playedRules(snapshot)

  const base = {
    floor: user.currentFloor,
    lives: user.lives,
    maxLives: played.lives,
    question: null as ServedQuestion | null,
    verdict: null as Verdict | null,
    cooldownUntil: user.cooldownUntil?.toISOString() ?? null,
    // Les règles jouées, effets compris : c'est là que le joueur lit s'il lui
    // faut un perfect pour repartir.
    recovery: user.lives <= 0 ? recoveryProgress(snapshot.recoveryRun, played) : null,
    floorSeen: seen,
    floorTotal: snapshot.floorTotal,
    attemptSeen: user.attemptSeen,
    seenTotal: user.seenTotal,
    chest: null as ChestView | null,
    maintenance: snapshot.gameClosed && !user.isAdmin && !user.isTest,
    // Lus à chaque état : l'attente les récapitule, l'ascension en affiche une
    // icône, et ce qui module les règles doit se voir là où il agit.
    effects: snapshot.effects.map(effect => ({ ...effect, stake: stakeOf(effect, user, played) })),
    // Vide par défaut, et rempli par la seule fonction qui vient d'écrire :
    // un état construit sans rien débloquer n'annonce rien.
    unlocked: [] as AchievementId[],
  }

  if (reservation && question) {
    const rules = rulesForFloor(user.currentFloor)

    // The verdict is carried whatever the phase: the question that took the last
    // life is precisely the one whose answer the player still has to read.
    if (reservation.resolvedAt) {
      base.verdict = {
        questionId: reservation.questionId,
        statement: question.statement,
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

/**
 * Ce qu'un effet change, en chiffres : la règle que le grimoire lui attribue,
 * de la base de l'étage aux règles jouées. Rien pour un effet qui n'agit pas
 * encore, ni pour un sort qui ne module rien.
 *
 * L'attente se lit sur le joueur plutôt que dans les règles : elles ne durent
 * pas toutes pareil (celle d'un rattrapage manqué est plus courte), et Répit en
 * déplace l'échéance — l'écart entre son début et son échéance est sa durée
 * réelle. Hors attente, il n'y en a pas à chiffrer.
 */
function stakeOf(effect: PlacedEffect, user: User, played: FloorRules): EffectStake | null {
  const rule = SPELLS[effect.spell].stakes?.[effect.face]

  // Même tri que les règles jouées : un sort lié à l'attente agit dès le lancer.
  if (!rule || (effect.state === 'pending' && !isCooldownBound(effect.spell))) {
    return null
  }

  if (rule === 'cooldownMs') {
    const { cooldownStartedAt: startedAt, cooldownUntil: until, cooldownBaseMs: baseMs } = user
    return startedAt && until && baseMs !== null
      ? { rule, before: baseMs, after: until.getTime() - startedAt.getTime() }
      : null
  }

  return { rule, before: rulesForFloor(user.currentFloor)[rule], after: played[rule] }
}

async function buildState(db: Database, userId: number, now: Date): Promise<GameState> {
  return stateFrom(await loadSnapshot(db, userId), now)
}

/**
 * Où en est le joueur, et rien d'autre.
 *
 * Lecture pure, et c'est tout ce qui la distingue de `readGameState` : celle-ci
 * ne résout aucune réservation expirée et ne clôt aucune attente échue.
 *
 * Une garde qui ne veut qu'un fait ne doit pas faire avancer la partie qu'elle
 * protège. Le chrono tombé coûte sa vie de toute façon, et c'est `/api/game/state`
 * qui l'acte — c'est son travail, écrit dans son contrat. Ce que la garde du
 * Grimoire faisait, c'est l'acter **une seconde fois, ailleurs**, sans que rien
 * ne l'annonce. Voir server/utils/inventory.ts.
 *
 * Un seul aller-retour, et deux lignes lues : le joueur porte déjà son décompte
 * de questions vues, il ne reste qu'à savoir s'il tient une question et ce que
 * son étage contient. Voir server/utils/deck.ts.
 */
export async function readPhase(db: Database, user: User, now: Date): Promise<Phase> {
  const [holding, deckFloor] = await db.batch([
    db
      .select({ userId: reservations.userId })
      .from(reservations)
      .where(and(eq(reservations.userId, user.id), isNull(reservations.resolvedAt)))
      .limit(1),
    floorSizeQuery(db, user.currentFloor),
  ])

  return phaseOf({
    user,
    hasLiveReservation: holding.length > 0,
    seen: user.floorSeen,
    floorTotal: sizeOf(deckFloor),
  }, now)
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
    const resolution = await resolve(db, snapshot, reservation, '', now, 'player', NOTHING_ACCEPTED)

    // Rien d'autre n'a bougé : l'attente ne peut pas s'achever dans la seconde où
    // elle démarre. On rend ce qui vient d'être écrit.
    //
    // Une lecture qui écrit annonce ce qu'elle a écrit : le délai écoulé pendant
    // que l'onglet était fermé débloque pour de bon, et l'annoncer ici est la
    // seule occasion de le dire. Elle ne se répétera pas — la réservation est
    // résolue, ce chemin ne repasse plus.
    return withUnlocked(stateFrom(resolution.snapshot, now), resolution.unlocked)
  }

  // Une attente qui vient de s'achever est le seul cas où une lecture a quelque
  // chose à écrire. Un palier ou une fin de partie n'en font pas partie : il n'y
  // a plus de vies à y rendre.
  const cooldownOver = phaseOfSnapshot(snapshot, false, now) === 'recovery'

  if (!cooldownOver) {
    return stateFrom(snapshot, now)
  }

  await resumeIfPoolTooSmall(db, snapshot.user, snapshot.recoveryRun.length > 0, now)

  return buildState(db, user.id, now)
}

/**
 * A cooldown that ends on a pool too small to draw a recovery from simply gives the
 * lives back. Nothing is reserved and no clock starts — the phase follows from the
 * time having passed. See specs/mecanique.md#tentative-attente-et-rattrapage.
 */
async function resumeIfPoolTooSmall(
  db: Database,
  user: User,
  /** Un rattrapage est tiré — lu dans l'instantané de l'appelant. */
  recovering: boolean,
  now: Date,
): Promise<void> {
  const elapsed = user.cooldownUntil !== null && now >= user.cooldownUntil

  if (user.lives > 0 || !elapsed || recovering) {
    return
  }

  if (canDrawRecovery(await poolSize(db, user), rulesForFloor(user.currentFloor))) {
    return
  }

  // Les vies pleines ouvrent une tentative : ce qui a été raté avant n'est plus
  // contestable. Voir specs/validation.md#contestation.
  await closeAttempt(db, user, now)
  await openAttempt(db, user, now)
}

/**
 * The player's own move: resolve whatever verdict they were reading, then reserve a
 * question drawn at random among those they have not seen on this floor.
 */
export async function serveNextQuestion(db: Database, user: User, now: Date): Promise<GameState> {
  // La question que le curseur désigne voyage avec l'instantané : servir la
  // suivante ne coûte alors qu'un aller-retour d'écriture. Voir server/utils/deck.ts.
  const [upcoming, ...rows] = await db.batch([nextQuestionQuery(db, user.id), ...snapshotQueries(db, user.id)])
  const snapshot = toSnapshot(rows)
  const { reservation } = snapshot
  // Le snapshot décrit fidèlement le joueur tant que rien n'a été résolu ici.
  let fresh = snapshot.user
  let recoveryRun = snapshot.recoveryRun
  // Ce que la résolution ci-dessous aura débloqué, à recoller sur l'état rendu :
  // le clic « suivant » résout la question expirée qu'il trouve, et ce qu'elle
  // débloque n'a pas d'autre occasion d'être annoncé.
  let unlocked: AchievementId[] = []

  // Le jeu est fermé : plus aucune question n'est servie, sauf à l'admin et aux
  // joueurs test — la maintenance ne doit pas empêcher de tester. Ce qui est
  // commencé se finit par d'autres chemins — répondre et ouvrir son coffre
  // restent permis, et le verdict se lit. Voir specs/admin.md#maintenance.
  if (snapshot.gameClosed && !snapshot.user.isAdmin && !snapshot.user.isTest) {
    return stateFrom(snapshot, now)
  }

  // Un coffre encore fermé retient le joueur : passer par-dessus lui ferait
  // perdre l'objet, et le clic « suivant » est justement celui dont l'ouverture
  // doit se distinguer. Voir specs/bonus.md#coffre-et-mimic.
  if (reservation?.chest === 'closed') {
    return stateFrom(snapshot, now)
  }

  if (reservation && !reservation.resolvedAt) {
    // A live reservation is not replaced: fleeing a question costs what a wrong
    // answer costs. An expired one resolves first, then the next is drawn.
    if (!isExpiredForUser(reservation, snapshot.user, now)) {
      return stateFrom(snapshot, now)
    }

    const resolution = await resolve(db, snapshot, reservation, '', now, 'player', NOTHING_ACCEPTED)
    fresh = resolution.snapshot.user
    recoveryRun = resolution.snapshot.recoveryRun
    unlocked = resolution.unlocked
  }

  // Une résolution juste au-dessus a pu ajouter une question vue — jamais en
  // rattrapage, d'où le delta rendu par resolve() plutôt qu'un « +1 » supposé.
  const current: PlayerSnapshot = { ...snapshot, user: fresh, recoveryRun }

  // Le joueur vient de cliquer : plus aucune question n'est en jeu, celle qu'il
  // tenait est résolue.
  const phase = phaseOfSnapshot(current, false, now)

  // La tour est finie : phase terminale, rien à tirer, rien à franchir. Rien à
  // débloquer non plus — la fin du jeu s'est gagnée sur la question qui l'a
  // atteinte, parce que cet écran-ci n'a aucune action et que personne n'y
  // repasse. Voir specs/succes.md#progression.
  if (phase === 'gameOver') {
    return withUnlocked(stateFrom(current, now), unlocked)
  }

  if (phase === 'floorEnd') {
    // Les règles de l'étage d'au-dessus : les effets ancrés le suivent, l'étage
    // change sous eux.
    const crossed = await crossFloor(db, current, fresh, playedRules(current, fresh.currentFloor + 1), now)

    // L'étage a changé, donc le décompte des questions vues et le total de
    // l'étage avec lui : on relit plutôt que de rapiécer un instantané qui ne
    // décrit plus le joueur. Cinq fois par partie, pas par question.
    return withUnlocked(await buildState(db, user.id, now), [...unlocked, ...crossed])
  }

  if (fresh.lives <= 0) {
    return withUnlocked(await advanceRecovery(db, current, fresh, playedRules(current), now), unlocked)
  }

  // Ni la résolution ni l'étage n'ont bougé le curseur : la question lue avec
  // l'instantané est toujours celle qu'il désigne.
  const [next] = upcoming
  const drawn = next ? await reserveDrawn(db, fresh, next.question, playedRules(current), now) : null

  if (!drawn) {
    // L'étage se compte des questions non vues qu'il n'a plus : le deck a bougé
    // sous le joueur. On efface le verdict qu'il vient de lire et on rend l'état
    // tel qu'il est — inventer un palier ici le ferait monter sans avoir joué.
    await db.delete(reservations).where(eq(reservations.userId, user.id))
    return withUnlocked(await buildState(db, user.id, now), unlocked)
  }

  // L'état renvoyé est exactement ce qu'on vient d'écrire : le relire coûterait
  // deux allers-retours de plus pour la même réponse.
  return withUnlocked(stateFrom({
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
  }, now), unlocked)
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
  const snapshot = await loadSnapshot(db, user.id)
  const { reservation } = snapshot
  const rules = rulesForFloor(snapshot.user.currentFloor)

  if (!reservation || reservation.chest !== 'closed') {
    return stateFrom(snapshot, now)
  }

  const outcome = rollChest(rules, random, snapshot.user.lastChest)
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

  const opened: Reservation = { ...reservation, chest }

  if (outcome.spell) {
    // Une ligne par exemplaire : le tirage ignore le stock, les doublons sont
    // illimités. Le sort arme le Mimic pour le coffre suivant.
    const armed = { lastChest: 'spell' as const }

    await db.batch([
      db.insert(inventory).values({ userId: user.id, spell: outcome.spell, obtainedAt: now }),
      db.update(users).set(armed).where(eq(users.id, user.id)),
    ])

    return stateFrom({ ...snapshot, user: { ...snapshot.user, ...armed }, reservation: opened }, now)
  }

  // Le Mimic retire toutes les vies d'un coup, traité comme une perte de dernière
  // vie ordinaire : l'attente démarre, et le verdict de la question — juste, elle
  // l'était — reste lisible par-dessus. La série tombe avec les vies : « toute vie
  // perdue casse la série » ne souffre pas d'exception, pas même celle-ci.
  const cooldown = cooldownFields(cooldownFrom(rules, now), now)
  const killed = { lives: 0, streak: 0, lastChest: 'mimic' as const, ...cooldown }

  await db.update(users).set(killed).where(eq(users.id, user.id))

  const unlocked = await unlock(db, snapshot.user, ['FIRST_DEATH'], now)

  return withUnlocked(stateFrom({
    ...snapshot,
    user: { ...snapshot.user, ...killed },
    reservation: opened,
  }, now), unlocked)
}

/**
 * Franchir le palier : l'étage monte d'un cran, le Pool Échecs de celui qu'on
 * quitte est abandonné — les ratées non rattrapées ne suivent pas le joueur — et
 * la question qu'il tenait reste en bas avec son verdict.
 * Appelée sur la phase `floorEnd`, qui garantit qu'un étage suivant existe.
 * Voir specs/mecanique.md#fin-détage.
 */
async function crossFloor(
  db: Database,
  snapshot: PlayerSnapshot,
  user: User,
  rules: FloorRules,
  now: Date,
): Promise<AchievementId[]> {
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
    // Étage neuf : le décompte des questions vues repart de zéro avec lui.
    // Écrit dans le même lot que l'étage, sinon un franchissement interrompu
    // laisserait le joueur au palier suivant avec le décompte du précédent.
    db.update(users).set({ currentFloor, floorSeen: 0 }).where(eq(users.id, user.id)),
  ])

  // Sans vie, on ne réserve rien : l'attente gagnée à l'étage d'en dessous
  // attend le joueur au nouveau, et un chrono qui tournerait pendant cette
  // attente lui coûterait une vie qu'il n'a pas.
  if (user.lives > 0) {
    // Étage neuf : le curseur repart de zéro, donc la première question de
    // l'étage est la première de rang supérieur à 0.
    await drawAndReserve(db, { ...user, currentFloor, floorCursor: 0, floorSeen: 0 }, rules, now)
  }

  // Le sans-faute de l'étage quitté s'est gagné à sa dernière question, dans
  // resolve() : ici on ne récompense que la montée elle-même.
  const earned = [
    ...earnedByCrossing(user.currentFloor),
    // Seul le premier étage franchi peut faire un premier arrivé : au suivant, la
    // place est prise depuis longtemps, et la réclamer coûterait une écriture par
    // palier pour rien.
    ...user.currentFloor === 1 ? await claimFirstAscent(db, user) : [],
  ]

  return unlock(db, snapshot.user, earned, now)
}

/** Ce qu'un tirage vient d'écrire, pour éviter d'aller le relire. */
interface DrawnQuestion {
  question: Question
  expiresAt: Date
}

/**
 * Sert la question suivante du deck, celle que le curseur du joueur désigne.
 * Rend null quand l'étage est épuisé — c'est ce qui fait le palier.
 */
async function drawAndReserve(
  db: Database,
  user: User,
  rules: FloorRules,
  now: Date,
): Promise<DrawnQuestion | null> {
  const [question] = await upcomingQuestions(db, user, 1)

  return question ? reserveDrawn(db, user, question, rules, now) : null
}

/** Réserve la question que le deck vient de désigner, et fait avancer le curseur jusqu'à elle. */
async function reserveDrawn(
  db: Database,
  user: User,
  question: Question,
  rules: FloorRules,
  now: Date,
): Promise<DrawnQuestion> {
  const expiresAt = new Date(now.getTime() + rules.ascentTimerMs)

  // Le curseur avance avec la question servie, dans le même lot qu'elle. C'est
  // lui qui porte la place du joueur dans le deck, et non sa réservation : un
  // rattrapage écrase celle-ci avec une question du Pool Échecs, dont le rang
  // n'a rien à voir.
  await db.batch([
    db.update(users).set({ floorCursor: question.rank }).where(eq(users.id, user.id)),
    reserve(db, user.id, question.id, 'ascent', expiresAt, now),
  ])

  return { question, expiresAt }
}

/**
 * Reserves one question for `mode`, replacing whatever the player was holding.
 * Rendue plutôt qu'exécutée, pour partir dans le lot de ce qui l'accompagne.
 */
function reserve(
  db: Database,
  userId: number,
  questionId: string,
  mode: 'ascent' | 'recovery',
  expiresAt: Date,
  now: Date,
) {
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

  return db
    .insert(reservations)
    .values({ userId, ...reserved })
    .onConflictDoUpdate({ target: reservations.userId, set: reserved })
}

/**
 * The player has no lives left. Either the cooldown is still running — nothing to do —
 * or a recovery starts, continues, or ends here. The recovery stops as soon as
 * the verdict is sealed: quota reached (success) or mathematically impossible
 * (failure). See specs/mecanique.md#déroulement-du-rattrapage.
 */
async function advanceRecovery(
  db: Database,
  snapshot: PlayerSnapshot,
  user: User,
  rules: FloorRules,
  now: Date,
): Promise<GameState> {
  const inCooldown = user.cooldownUntil !== null && now < user.cooldownUntil
  if (inCooldown) {
    return buildState(db, user.id, now)
  }

  let opened: AchievementId[] = []
  // Le tirage vient de l'instantané : un rattrapage déjà tiré ne coûte aucune
  // lecture pour savoir où il en est.
  let run = snapshot.recoveryRun

  if (!run.length) {
    const drawn = await db
      .select()
      .from(missedPool)
      .where(and(eq(missedPool.userId, user.id), eq(missedPool.floor, user.currentFloor)))
      .orderBy(sql`RANDOM()`)
      .limit(rules.recoveryQuestions)

    // Le seuil se lit dans les règles de l'étage, jamais dans les règles
    // modulées : une Indulgence double le tirage, elle ne relève pas la barre
    // d'entrée — sinon elle empêcherait le rattrapage qu'elle rallonge.
    if (!canDrawRecovery(drawn.length, rulesForFloor(user.currentFloor))) {
      // Trop maigre pour y tirer : l'attente se termine et les vies reviennent.
      await resumeIfPoolTooSmall(db, user, false, now)
      return buildState(db, user.id, now)
    }

    run = drawn.map((entry, position) => ({
      userId: user.id,
      questionId: entry.questionId,
      position,
      correct: null,
    }))
    await db.insert(recoveryQuestions).values(run)

    // Le tirage posé, le rattrapage commence : c'est l'entrée en phase, et le seul
    // instant où elle se produit. Un pool trop maigre rend les vies sans jamais
    // passer ici — il n'y a pas eu de rattrapage.
    opened = await unlock(db, snapshot.user, ['FIRST_RECOVERY'], now)
  }

  // Le verdict est scellé — quota atteint ou mathématiquement impossible — : on
  // ne sert pas la question suivante, le rattrapage s'arrête là. Les questions
  // non jouées restent dans le Pool Échecs sans progression de leur compteur.
  // Voir specs/mecanique.md#déroulement-du-rattrapage.
  const progress = recoveryProgress(run, rules)

  if (progress !== null && progress.sealed) {
    return withUnlocked(await finishRecovery(db, snapshot, user, progress, rules, now), opened)
  }

  // Le tirage est rangé par position : la première non jouée est la suivante.
  const nextUp = run.find(entry => entry.correct === null)

  if (!nextUp) {
    return withUnlocked(await finishRecovery(db, snapshot, user, progress, rules, now), opened)
  }

  await reserve(
    db,
    user.id,
    nextUp.questionId,
    'recovery',
    new Date(now.getTime() + rules.recoveryTimerMs),
    now,
  )

  return withUnlocked(await buildState(db, user.id, now), opened)
}

/**
 * Settles the recovery verdict — lives back on success, a shorter cooldown on failure
 * — and, on success, chains directly to ascent by drawing the next question.
 * No intermediate screen: the verdict of the sealing question carries the
 * message, and the button « Reprendre » leads straight to the next question.
 * See specs/mecanique.md#déroulement-du-rattrapage.
 */
async function finishRecovery(
  db: Database,
  snapshot: PlayerSnapshot,
  user: User,
  /** Lu par l'appelant sur le tirage qu'il tient : il ne se relit pas. */
  progress: RecoveryProgress | null,
  recoveryRules: FloorRules,
  now: Date,
): Promise<GameState> {
  const verdict = judgeRecovery(progress?.successes ?? 0, progress?.total ?? 0, recoveryRules, now)

  // Le tirage joué en entier, et juste de bout en bout. Depuis que le rattrapage
  // s'arrête au verdict scellé, cela n'arrive que lorsque le quota exige tout le
  // tirage — sous Indulgence noire. Voir specs/succes.md#rattrapage.
  const perfect = progress !== null
    && progress.total > 0
    && progress.played === progress.total
    && progress.successes === progress.total

  const unlocked = perfect
    ? await unlock(db, snapshot.user, ['RECOVERY_PERFECT'], now)
    : []

  // Le rattrapage s'efface d'un seul geste : une interruption entre les deux
  // laisserait une réservation sur un tirage qui n'existe plus.
  const cleared = [
    db.delete(recoveryQuestions).where(eq(recoveryQuestions.userId, user.id)),
    db.delete(reservations).where(eq(reservations.userId, user.id)),
  ] as const

  if (verdict.resumes) {
    await db.batch(cleared)

    // La tentative ne se clôt qu'au moment où la suivante s'ouvre : une attente
    // de plus prolonge celle qui court. Les vies rendues sont celles de la
    // tentative qui s'ouvre, effets compris — d'où openAttempt plutôt que le
    // décompte du verdict, qui ne connaît que les règles de l'étage.
    await closeAttempt(db, user, now)
    const attemptRules = await openAttempt(db, user, now)

    // Le rattrapage réussi enchaîne directement sur l'ascension : plus d'écran
    // intermédiaire. drawAndReserve ne lit que currentFloor et floorCursor,
    // qu'openAttempt n'a pas touchés — le user périmé (lives: 0) suffit. La
    // question est celle de la tentative qui s'ouvre : ses effets fraîchement
    // ancrés jouent dès elle.
    await drawAndReserve(db, user, attemptRules, now)

    return withUnlocked(await buildState(db, user.id, now), unlocked)
  }

  // Manqué : l'attente plus courte part dans le même lot que l'effacement.
  await db.batch([
    ...cleared,
    db
      .update(users)
      .set({ lives: verdict.livesAfter, ...cooldownFields(verdict.cooldownUntil, now) })
      .where(eq(users.id, user.id)),
  ])

  // Le verdict du rattrapage se lit sur le verdict de la question qui l'a
  // scellé.
  return withUnlocked(await buildState(db, user.id, now), unlocked)
}

/**
 * Une question vue, telle que le Volumen la relit : l'énoncé avec sa réponse —
 * c'est une fiche de révision, pas une punition — ce que le joueur avait saisi,
 * et ce qu'il en reste à faire si elle est encore au Pool Échecs.
 * Voir specs/ecrans.md#volumen.
 */
export interface QuestionLogEntryView {
  questionId: string
  statement: string
  answerLabel: string
  /** What the player answered — justifies disputing. Null on timeout. */
  submittedAnswer: string | null
  correct: boolean
  /** Ses Réussites, tant qu'elle est au Pool Échecs ; null ailleurs. */
  poolSuccesses: number | null
  /** Statut de la contestation : none si pas disputée, pending en attente d'arbitrage, rejected si refusée. */
  disputeStatus: 'none' | 'pending' | 'rejected'
}

export interface QuestionLogPage {
  entries: QuestionLogEntryView[]
  /**
   * Compté en page 1 seulement, null au-delà : le total ne bouge pas d'une page
   * à l'autre, et compter lit chaque ligne comptée — Turso facture chacune.
   * L'écran garde celui de la page 1.
   */
  total: number | null
  /** Le seuil de sortie du pool, pour lire les Réussites sur ce qu'il exige. */
  poolSuccessesToLeave: number
}

export interface QuestionLogQuery {
  limit: number
  offset: number
}

/**
 * Ce que les deux lectures du Volumen sélectionnent, joint de la même façon. Une
 * contestation acceptée a rendu la question juste : il n'y a plus rien à en
 * dire, elle se lit comme une question jamais contestée.
 */
const QUESTION_LOG_COLUMNS = {
  questionId: seenQuestions.questionId,
  statement: questions.statement,
  answerLabel: questions.answerLabel,
  submittedAnswer: seenQuestions.submittedAnswer,
  correct: seenQuestions.correct,
  poolSuccesses: missedPool.poolSuccesses,
  disputeStatus: sql<QuestionLogEntryView['disputeStatus']>`case when ${disputes.status} in ('pending', 'rejected') then ${disputes.status} else 'none' end`,
}

/**
 * Une page du Volumen, et son total quand c'est la première : la page et le
 * compte partent dans le même lot, un clic de pagination fait un aller-retour.
 */
async function questionLogPage(
  db: Database,
  user: User,
  offset: number,
  rows: RunnableQuery<QuestionLogEntryView[], 'sqlite'> & PromiseLike<QuestionLogEntryView[]>,
  total: RunnableQuery<{ value: number }[], 'sqlite'>,
): Promise<QuestionLogPage> {
  const poolSuccessesToLeave = rulesForFloor(user.currentFloor).poolSuccessesToLeave

  if (offset > 0) {
    return { entries: await rows, total: null, poolSuccessesToLeave }
  }

  const [entries, [{ value }]] = await db.batch([rows, total])

  return { entries, total: value, poolSuccessesToLeave }
}

/**
 * The missed pool of the player's floor, answers included — the Volumen's first
 * tab. By last failure, newest first: what resists is what one wants to reread.
 * See specs/ecrans.md#volumen.
 */
export async function readMissedPool(
  db: Database,
  user: User,
  query: QuestionLogQuery,
): Promise<QuestionLogPage> {
  const onThisFloor = and(
    eq(missedPool.userId, user.id),
    eq(missedPool.floor, user.currentFloor),
  )

  return questionLogPage(
    db,
    user,
    query.offset,
    db
      .select(QUESTION_LOG_COLUMNS)
      .from(missedPool)
      .innerJoin(questions, eq(questions.id, missedPool.questionId))
      .innerJoin(seenQuestions, and(
        eq(seenQuestions.userId, missedPool.userId),
        eq(seenQuestions.questionId, missedPool.questionId),
      ))
      .leftJoin(disputes, and(
        eq(disputes.userId, missedPool.userId),
        eq(disputes.questionId, missedPool.questionId),
      ))
      .where(onThisFloor)
      // L'identifiant départage deux échecs de la même seconde : une page ne
      // doit pas en reprendre une de la précédente.
      .orderBy(desc(missedPool.lastFailedAt), asc(missedPool.questionId))
      .limit(query.limit)
      .offset(query.offset),
    db.select({ value: count() }).from(missedPool).where(onThisFloor),
  )
}

/**
 * Les questions vues depuis la dernière remise à zéro, tous étages confondus —
 * toutes, ou les justes seulement. La plus récente en tête. Les onglets Connues et
 * Toutes du Volumen. See specs/ecrans.md#volumen.
 *
 * Les vingt de la page se choisissent d'abord, dans l'index couvrant des vues
 * (`seen_questions_user_log_idx`), et seules elles sont jointes : une page
 * sautée ne coûte qu'une entrée d'index, pas quatre lignes jointes.
 */
export async function readQuestionLog(
  db: Database,
  user: User,
  query: QuestionLogQuery & { filter: 'correct' | 'all' },
): Promise<QuestionLogPage> {
  const filter = and(
    eq(seenQuestions.userId, user.id),
    query.filter === 'correct' ? eq(seenQuestions.correct, true) : undefined,
  )
  // L'identifiant départage deux vues de la même seconde, dans le sens de
  // l'index : il se lit à rebours d'un bout à l'autre, sans rien trier.
  const newestFirst = [desc(seenQuestions.seenAt), desc(seenQuestions.questionId)]

  const onThisPage = db
    .select({ questionId: seenQuestions.questionId })
    .from(seenQuestions)
    .where(filter)
    .orderBy(...newestFirst)
    .limit(query.limit)
    .offset(query.offset)
    .as('on_this_page')

  return questionLogPage(
    db,
    user,
    query.offset,
    db
      .select(QUESTION_LOG_COLUMNS)
      .from(onThisPage)
      .innerJoin(seenQuestions, and(
        eq(seenQuestions.userId, user.id),
        eq(seenQuestions.questionId, onThisPage.questionId),
      ))
      .innerJoin(questions, eq(questions.id, seenQuestions.questionId))
      .leftJoin(missedPool, and(
        eq(missedPool.userId, seenQuestions.userId),
        eq(missedPool.questionId, seenQuestions.questionId),
      ))
      .leftJoin(disputes, and(
        eq(disputes.userId, seenQuestions.userId),
        eq(disputes.questionId, seenQuestions.questionId),
      ))
      .orderBy(...newestFirst),
    db.select({ value: count() }).from(seenQuestions).where(filter),
  )
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
  // Les libellés acceptés voyagent avec l'instantané : juger la réponse ne coûte
  // plus d'aller-retour à part.
  const [accepted, ...rows] = await db.batch([acceptedQuery(db, user.id), ...snapshotQueries(db, user.id)])
  const snapshot = toSnapshot(rows)
  const { reservation } = snapshot

  if (!reservation || reservation.resolvedAt) {
    // Rien à résoudre : l'appareil qui a envoyé ça est en retard, pas fautif.
    return stateFrom(snapshot, now)
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

  const resolution = await resolve(db, snapshot, reservation, answer, now, source, accepted.map(row => row.text))

  return withUnlocked(stateFrom(resolution.snapshot, now), resolution.unlocked)
}
