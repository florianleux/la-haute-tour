import { and, asc, count, desc, eq, isNull, sql } from 'drizzle-orm'
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
import { floorSizeQuery, sizeOf, upcomingQuestions } from './deck'
import { closeAttempt, openAttempt } from './journey'
import { effectsQuery, toEffectViews } from './effects'
import { isCooldownBound } from '../../shared/utils/spells'
import { rulesForFloor } from './rules'
import { rulesWithEffects, SPELLS } from './spellbook'
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
import type { EffectStake, EffectView, PlacedEffect } from './effects'
import type { AchievementId } from '../../shared/utils/achievements'
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
  /** False only while the player has never resolved nor reserved anything. */
  started: boolean
  question: ServedQuestion | null
  verdict: Verdict | null
  /** ISO 8601 end of the wait, null outside a wait. */
  cooldownUntil: string | null
  /** Tally of the recovery under way, null outside one. */
  recovery: RecoveryProgress | null
  /**
   * Le sort du dernier rattrapage, posé une fois ses questions jouées.
   * Plus aucun écran ne le lit depuis que l'attente ne rappelle plus l'échec :
   * le verdict de la question qui scelle le rattrapage l'annonce seul.
   * Effacé au clic suivant.
   */
  recoveryResult: 'failed' | null
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
 * two of them rather than one per fact: the player and their two counters travel
 * together, and the reservation brings its question along.
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

async function loadSnapshot(db: Database, userId: number): Promise<PlayerSnapshot> {
  const [row] = await db
    .select({
      user: users,
      // Lu avec le joueur plutôt qu'à part : la maintenance se consulte à chaque
      // lecture d'état, et un aller-retour de plus par question se paierait cher.
      gameClosed: sql<number>`coalesce((select ${settings.maintenanceSince} is not null
        from ${settings} where ${settings.id} = 1), 0)`,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  // La réservation, les effets et la taille de l'étage voyagent dans le même
  // lot : trois requêtes, un seul aller-retour réseau.
  // Voir tests/server/query-budget.test.ts.
  const [holding, effects, deckFloor] = await db.batch([
    db
      .select({ reservation: reservations, question: questions })
      .from(reservations)
      .innerJoin(questions, eq(questions.id, reservations.questionId))
      .where(eq(reservations.userId, userId))
      .limit(1),
    effectsQuery(db, userId),
    floorSizeQuery(db, row.user.currentFloor),
  ])

  const [held] = holding

  return {
    // Le joueur porte ses deux décomptes de questions vues, il ne les compte
    // plus : les compter coûtait une ligne par question déjà vue, à chaque
    // lecture d'état. Voir server/db/schema.ts.
    user: row.user,
    effects: toEffectViews(effects, row.user),
    // Lue au deck plutôt que comptée : une ligne, quel que soit l'étage.
    // Voir server/utils/deck.ts.
    floorTotal: sizeOf(deckFloor),
    gameClosed: row.gameClosed === 1,
    reservation: held?.reservation,
    question: held?.question,
  }
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

async function hasRecoveryRun(db: Database, userId: number): Promise<boolean> {
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
async function recoveryProgress(
  db: Database,
  user: User,
  rules: FloorRules,
): Promise<RecoveryProgress | null> {
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
    // Le seuil se lit dans les règles **jouées** : une Indulgence noire exige un
    // perfect, et c'est ici que le joueur le lit avant de finir.
    // Voir specs/bonus.md#catalogue.
    resumes: resumesRecovery(successes, drawn.length, rules),
    sealed: sealedRecovery(successes, played.length, drawn.length, rules),
    required: recoveryThreshold(drawn.length, rules),
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
): Promise<{ leavesPool: boolean }> {
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
    return { leavesPool: false }
  }

  const membership = and(
    eq(missedPool.userId, user.id),
    eq(missedPool.questionId, questionId),
  )
  const move = movePoolCounter(entry, correct, rulesForFloor(user.currentFloor), now)

  if (move.leaves) {
    await db.delete(missedPool).where(membership)
    return { leavesPool: true }
  }

  await db
    .update(missedPool)
    .set({ poolSuccesses: move.poolSuccesses, lastFailedAt: move.lastFailedAt })
    .where(membership)

  return { leavesPool: false }
}

/** La même question, lue à travers les règles de l'étage où se tient le joueur. */
function isExpiredForUser(reservation: Reservation, user: User, now: Date): boolean {
  return isExpired(reservation.expiresAt, rulesForFloor(user.currentFloor), now)
}

/** Ce que la résolution vient d'écrire, pour éviter d'aller le relire. */
interface Resolution {
  user: User
  reservation: Reservation
  /** Les succès que cette résolution a réellement gravés. Voir specs/succes.md. */
  unlocked: AchievementId[]
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

  // Le jour joué s'estampille pour toute question résolue, rattrapage compris :
  // une journée passée entièrement à rattraper est une journée jouée. Rend null
  // quand le joueur a déjà joué aujourd'hui, et il n'y a alors rien à écrire.
  // Voir specs/succes.md#assiduité.
  const played = playedToday(user, now)

  if (reservation.mode === 'recovery') {
    // Aucune vie perdue, aucune progression : le rattrapage ne joue que sur les
    // compteurs du Pool Échecs. Les compteurs de progression passent donc
    // inchangés — ce qu'ils portaient déjà est de toute façon déjà acquis.
    const { leavesPool } = await resolveRecovery(db, user, reservation.questionId, correct, now)
    const recovering: User = { ...user, ...played }

    if (played) {
      await db.update(users).set(played).where(eq(users.id, user.id))
    }

    const earned = [
      ...answeredAchievements(recovering, correct, answer === '', false),
      ...leavesPool ? ['POOL_CLEARED' as const] : [],
    ]

    return {
      user: recovering,
      reservation: resolved,
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

  if (!entersPool) {
    await db.batch([markSeen, advance])

    return { user: fresh, reservation: resolved, unlocked: await unlock(db, snapshot.user, earned, now) }
  }

  await db.batch([
    markSeen,
    db
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
      }),
    advance,
  ])

  return { user: fresh, reservation: resolved, unlocked: await unlock(db, snapshot.user, earned, now) }
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
async function stateFrom(db: Database, snapshot: PlayerSnapshot, now: Date): Promise<GameState> {
  const { user, reservation, question } = snapshot
  const seen = user.floorSeen
  const played = playedRules(snapshot)

  const base = {
    floor: user.currentFloor,
    lives: user.lives,
    maxLives: played.lives,
    started: seen > 0 || reservation !== undefined,
    question: null as ServedQuestion | null,
    verdict: null as Verdict | null,
    cooldownUntil: user.cooldownUntil?.toISOString() ?? null,
    // Les règles jouées, effets compris : c'est là que le joueur lit s'il lui
    // faut un perfect pour repartir.
    recovery: user.lives <= 0 ? await recoveryProgress(db, user, played) : null,
    recoveryResult: null as 'failed' | null,
    floorSeen: seen,
    floorTotal: snapshot.floorTotal,
    attemptSeen: user.attemptSeen,
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
  return stateFrom(db, await loadSnapshot(db, userId), now)
}

/**
 * Où en est le joueur, et rien d'autre.
 *
 * Lecture pure, et c'est tout ce qui la distingue de `readGameState` : celle-ci
 * ne résout aucune réservation expirée et ne clôt aucune attente échue.
 *
 * Une garde qui ne veut qu'un fait ne doit pas faire avancer la partie qu'elle
 * protège. Le chrono tombé coûte sa vie de toute façon, et c'est `/api/game/state`
 * qui l'acte — c'est son travail, écrit dans son contrat. Ce que la garde de la
 * page Sorts faisait, c'est l'acter **une seconde fois, ailleurs**, sans que rien
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
    const resolution = await resolve(db, snapshot, reservation, '', now)

    // Rien d'autre n'a bougé : l'attente ne peut pas s'achever dans la seconde où
    // elle démarre. On rend ce qui vient d'être écrit.
    //
    // Une lecture qui écrit annonce ce qu'elle a écrit : le délai écoulé pendant
    // que l'onglet était fermé débloque pour de bon, et l'annoncer ici est la
    // seule occasion de le dire. Elle ne se répétera pas — la réservation est
    // résolue, ce chemin ne repasse plus.
    return withUnlocked(await stateFrom(db, {
      ...snapshot,
      user: resolution.user,
      reservation: resolution.reservation,
    }, now), resolution.unlocked)
  }

  // Une attente qui vient de s'achever est le seul cas où une lecture a quelque
  // chose à écrire. Un palier ou une fin de partie n'en font pas partie : il n'y
  // a plus de vies à y rendre.
  const cooldownOver = phaseOfSnapshot(snapshot, false, now) === 'recovery'

  if (!cooldownOver) {
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
  const snapshot = await loadSnapshot(db, user.id)
  const { reservation } = snapshot
  // Le snapshot décrit fidèlement le joueur tant que rien n'a été résolu ici.
  let fresh = snapshot.user
  // Ce que la résolution ci-dessous aura débloqué, à recoller sur l'état rendu :
  // le clic « suivant » résout la question expirée qu'il trouve, et ce qu'elle
  // débloque n'a pas d'autre occasion d'être annoncé.
  let unlocked: AchievementId[] = []

  // Le jeu est fermé : plus aucune question n'est servie, sauf à l'admin et aux
  // joueurs test — la maintenance ne doit pas empêcher de tester. Ce qui est
  // commencé se finit par d'autres chemins — répondre et ouvrir son coffre
  // restent permis, et le verdict se lit. Voir specs/admin.md#maintenance.
  if (snapshot.gameClosed && !snapshot.user.isAdmin && !snapshot.user.isTest) {
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
    unlocked = resolution.unlocked
  }

  // Une résolution juste au-dessus a pu ajouter une question vue — jamais en
  // rattrapage, d'où le delta rendu par resolve() plutôt qu'un « +1 » supposé.
  const current: PlayerSnapshot = { ...snapshot, user: fresh }

  // Le joueur vient de cliquer : plus aucune question n'est en jeu, celle qu'il
  // tenait est résolue.
  const phase = phaseOfSnapshot(current, false, now)

  // La tour est finie : phase terminale, rien à tirer, rien à franchir. Rien à
  // débloquer non plus — la fin du jeu s'est gagnée sur la question qui l'a
  // atteinte, parce que cet écran-ci n'a aucune action et que personne n'y
  // repasse. Voir specs/succes.md#progression.
  if (phase === 'gameOver') {
    return withUnlocked(await stateFrom(db, current, now), unlocked)
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

  const drawn = await drawAndReserve(db, fresh, playedRules(current), now)

  if (!drawn) {
    // L'étage se compte des questions non vues qu'il n'a plus : le deck a bougé
    // sous le joueur. On efface le verdict qu'il vient de lire et on rend l'état
    // tel qu'il est — inventer un palier ici le ferait monter sans avoir joué.
    await db.delete(reservations).where(eq(reservations.userId, user.id))
    return withUnlocked(await buildState(db, user.id, now), unlocked)
  }

  // L'état renvoyé est exactement ce qu'on vient d'écrire : le relire coûterait
  // deux allers-retours de plus pour la même réponse.
  return withUnlocked(await stateFrom(db, {
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
  // l'était — reste lisible par-dessus. La série tombe avec les vies : « toute vie
  // perdue casse la série » ne souffre pas d'exception, pas même celle-ci.
  const cooldown = cooldownFields(cooldownFrom(rules, now), now)
  const killed = { lives: 0, streak: 0, ...cooldown }

  await db.update(users).set(killed).where(eq(users.id, user.id))

  const unlocked = await unlock(db, snapshot.user, ['FIRST_DEATH'], now)

  return withUnlocked(await stateFrom(db, {
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

  if (!question) {
    return null
  }

  const expiresAt = new Date(now.getTime() + rules.ascentTimerMs)

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

  if (!await hasRecoveryRun(db, user.id)) {
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
      await resumeIfPoolTooSmall(db, user, now)
      return buildState(db, user.id, now)
    }

    await db.insert(recoveryQuestions).values(
      drawn.map((entry, position) => ({ userId: user.id, questionId: entry.questionId, position })),
    )

    // Le tirage posé, le rattrapage commence : c'est l'entrée en phase, et le seul
    // instant où elle se produit. Un pool trop maigre rend les vies sans jamais
    // passer ici — il n'y a pas eu de rattrapage.
    opened = await unlock(db, snapshot.user, ['FIRST_RECOVERY'], now)
  }

  // Le verdict est scellé — quota atteint ou mathématiquement impossible — : on
  // ne sert pas la question suivante, le rattrapage s'arrête là. Les questions
  // non jouées restent dans le Pool Échecs sans progression de leur compteur.
  // Voir specs/mecanique.md#déroulement-du-rattrapage.
  const progress = await recoveryProgress(db, user, rules)

  if (progress !== null && progress.sealed) {
    return withUnlocked(await finishRecovery(db, snapshot, user, rules, now), opened)
  }

  const [nextUp] = await db
    .select()
    .from(recoveryQuestions)
    .where(and(eq(recoveryQuestions.userId, user.id), isNull(recoveryQuestions.correct)))
    .orderBy(recoveryQuestions.position)
    .limit(1)

  if (!nextUp) {
    return withUnlocked(await finishRecovery(db, snapshot, user, rules, now), opened)
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
 * Settles the recovery verdict — lives back on success, a shorter wait on failure
 * — and, on success, chains directly to ascent by drawing the next question.
 * No intermediate screen: the verdict of the sealing question carries the
 * message, and the button « Reprendre » leads straight to the next question.
 * See specs/mecanique.md#déroulement-du-rattrapage.
 */
async function finishRecovery(
  db: Database,
  snapshot: PlayerSnapshot,
  user: User,
  rules: FloorRules,
  now: Date,
): Promise<GameState> {
  const progress = await recoveryProgress(db, user, rules)
  const verdict = judgeRecovery(progress?.successes ?? 0, progress?.total ?? 0, rules, now)

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

  await db.delete(recoveryQuestions).where(eq(recoveryQuestions.userId, user.id))
  await db.delete(reservations).where(eq(reservations.userId, user.id))

  if (verdict.resumes) {
    // La tentative ne se clôt qu'au moment où la suivante s'ouvre : une attente
    // de plus prolonge celle qui court. Les vies rendues sont celles de la
    // tentative qui s'ouvre, effets compris — d'où openAttempt plutôt que le
    // décompte du verdict, qui ne connaît que les règles de l'étage.
    await closeAttempt(db, user, now)
    const attemptRules = await openAttempt(db, user, now)

    // Le rattrapage réussi enchaîne directement sur l'ascension : plus d'écran
    // intermédiaire. drawAndReserve ne lit que currentFloor et floorCursor,
    // qu'openAttempt n'a pas touchés — le user périmé (lives: 0) suffit. Les
    // règles, elles, sont celles de la tentative qui s'ouvre : la question est
    // la sienne, et ses effets fraîchement ancrés jouent dès elle.
    await drawAndReserve(db, user, attemptRules, now)

    return withUnlocked(await buildState(db, user.id, now), unlocked)
  }

  await db
    .update(users)
    .set({ lives: verdict.livesAfter, ...cooldownFields(verdict.cooldownUntil, now) })
    .where(eq(users.id, user.id))

  // Le verdict du rattrapage se lit sur le verdict de la question qui l'a
  // scellé ; il voyage avec l'état jusqu'à ce que le joueur reprenne.
  return withUnlocked(
    { ...await buildState(db, user.id, now), recoveryResult: 'failed' },
    unlocked,
  )
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
  const snapshot = await loadSnapshot(db, user.id)
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

  return withUnlocked(await stateFrom(db, {
    ...snapshot,
    user: resolution.user,
    reservation: resolution.reservation,
  }, now), resolution.unlocked)
}
