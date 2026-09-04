import { sql } from 'drizzle-orm'
import { check, index, integer, primaryKey, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core'
import { FLOOR_COUNT } from '../../shared/utils/floors'

/**
 * Discord IDs allowed to sign up. Filled manually (admin UI or raw SQL).
 * No row here, no account created. See specs/anti-triche.md.
 */
export const whitelist = sqliteTable('whitelist', {
  discordId: text('discord_id').primaryKey(),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
})

/**
 * A player and their game state (current floor, lives). Game state lives in the
 * database, never in a client session. See specs/architecture.md.
 */
export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  discordId: text('discord_id').notNull().unique(),
  username: text('username').notNull(),
  email: text('email'),
  /**
   * Le hash d'avatar Discord, resynchronisé à chaque connexion. Null tant que le
   * joueur ne s'est pas reconnecté depuis l'ajout de la colonne, ou s'il n'a pas
   * d'avatar : l'affichage retombe alors sur l'avatar Discord par défaut.
   */
  avatar: text('avatar'),
  isAdmin: integer('is_admin', { mode: 'boolean' }).notNull().default(false),
  currentFloor: integer('current_floor').notNull().default(1),
  lives: integer('lives').notNull().default(3),
  /** When the wait ends. Null outside a wait. The phase derives from it. */
  cooldownUntil: integer('cooldown_until', { mode: 'timestamp' }),
  /**
   * Début de la tentative en cours — repoussé chaque fois que les vies
   * reviennent. C'est lui qui dit quelles erreurs sont encore contestables.
   *
   * Défaut à l'époque zéro, et non à maintenant : SQLite refuse d'ajouter une
   * colonne NOT NULL dont le défaut n'est pas constant, donc la migration ne
   * s'appliquerait sur aucune base existante. Une tentative ouverte « depuis
   * toujours » dit la même chose pour un joueur qui commence — il n'a pas
   * d'erreur antérieure. Voir specs/validation.md#contestation.
   */
  attemptStartedAt: integer('attempt_started_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`0`),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
})

/**
 * A question of the shared deck. `floor` carries the difficulty too — floors 1-2
 * hold difficulty 1, 3-4 difficulty 2, 5-6 difficulty 3 — so difficulty is derived
 * (`ceil(floor / 2)`), never stored. See specs/spec.md.
 *
 * `answerLabel` is what the player is shown on failure ("FLEMING (Alexander)");
 * it is never matched against. Matching goes through `acceptedAnswers`.
 */
export const questions = sqliteTable('questions', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  statement: text('statement').notNull(),
  answerLabel: text('answer_label').notNull(),
  floor: integer('floor').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
}, table => [
  check('questions_floor_range', sql`${table.floor} BETWEEN 1 AND ${sql.raw(String(FLOOR_COUNT))}`),
  index('questions_floor_idx').on(table.floor),
])

/**
 * Every wording that validates a question — none is privileged, the typo tolerance
 * applies to each. One row per answer so accepting a dispute is a single insert and
 * the admin CRUD can address one. See specs/validation.md.
 */
export const acceptedAnswers = sqliteTable('accepted_answers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  questionId: text('question_id')
    .notNull()
    .references(() => questions.id, { onDelete: 'cascade' }),
  text: text('text').notNull(),
}, table => [index('accepted_answers_question_idx').on(table.questionId)])

/** Themes a question belongs to (Histoire, Musique, Sport…). Seeded by the import. */
export const categories = sqliteTable('categories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
})

export const questionCategories = sqliteTable('question_categories', {
  questionId: text('question_id')
    .notNull()
    .references(() => questions.id, { onDelete: 'cascade' }),
  categoryId: integer('category_id')
    .notNull()
    .references(() => categories.id, { onDelete: 'cascade' }),
}, table => [
  primaryKey({ columns: [table.questionId, table.categoryId] }),
  index('question_categories_category_idx').on(table.categoryId),
])

/**
 * A question resolved in ascent, right or wrong. The only unit of progress:
 * it is the count of seen questions that ends a floor and the game.
 */
export const seenQuestions = sqliteTable('seen_questions', {
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  questionId: text('question_id')
    .notNull()
    .references(() => questions.id, { onDelete: 'cascade' }),
  /** The floor it was seen on — a floor's progress is read without joining. */
  floor: integer('floor').notNull(),
  correct: integer('correct', { mode: 'boolean' }).notNull(),
  /**
   * Ce que le joueur avait répondu. Conservé au-delà de la réservation : c'est
   * la pièce que l'admin arbitre quand la question est contestée, et elle doit
   * survivre au passage à la question suivante.
   */
  submittedAnswer: text('submitted_answer'),
  seenAt: integer('seen_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
}, table => [
  primaryKey({ columns: [table.userId, table.questionId] }),
  index('seen_questions_user_floor_idx').on(table.userId, table.floor),
])

/**
 * The question served to a player, held server-side until it resolves. At most
 * one per player — hence the primary key. Once resolved it carries the verdict,
 * which survives a refresh and a change of device, until the player moves on.
 * See specs/mecanique.md#réservation.
 */
export const reservations = sqliteTable('reservations', {
  userId: integer('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  questionId: text('question_id')
    .notNull()
    .references(() => questions.id, { onDelete: 'cascade' }),
  /** Which phase served it: the timer and what a failure costs differ. */
  mode: text('mode', { enum: ['ascent', 'recovery'] }).notNull().default('ascent'),
  /** Fixed when the question was reserved; the client's countdown only renders it. */
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  resolvedAt: integer('resolved_at', { mode: 'timestamp' }),
  /** Verdict, null while the reservation is still live. */
  correct: integer('correct', { mode: 'boolean' }),
  submittedAnswer: text('submitted_answer'),
})

/**
 * Questions missed on the current floor, waiting for recovery. Persistent: never
 * reset while the player stays on the floor. See specs/mecanique.md#pool-échecs.
 */
export const missedPool = sqliteTable('missed_pool', {
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  questionId: text('question_id')
    .notNull()
    .references(() => questions.id, { onDelete: 'cascade' }),
  floor: integer('floor').notNull(),
  /** Consecutive recovery successes; a wrong answer puts it back to zero. */
  poolSuccesses: integer('pool_successes').notNull().default(0),
  lastFailedAt: integer('last_failed_at', { mode: 'timestamp' }).notNull(),
}, table => [
  primaryKey({ columns: [table.userId, table.questionId] }),
  index('missed_pool_user_floor_idx').on(table.userId, table.floor, table.lastFailedAt),
])

/**
 * The questions drawn for one recovery, in the order they are played. Rows exist
 * only while a recovery is under way: every question is played, and the run's
 * outcome — lives back, or a shorter wait — is settled when the last one is.
 * See specs/mecanique.md#déroulement-du-rattrapage.
 */
export const recoveryQuestions = sqliteTable('recovery_questions', {
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  questionId: text('question_id')
    .notNull()
    .references(() => questions.id, { onDelete: 'cascade' }),
  position: integer('position').notNull(),
  /** Null until the question has been played. */
  correct: integer('correct', { mode: 'boolean' }),
}, table => [
  primaryKey({ columns: [table.userId, table.questionId] }),
  index('recovery_questions_user_position_idx').on(table.userId, table.position),
])

/**
 * Une contestation : le joueur affirme que sa réponse valait la bonne, l'admin
 * tranche. Une seule par question et par joueur — contester deux fois n'ajoute
 * rien à arbitrer. La réponse contestée n'est pas recopiée ici : elle vit dans
 * la question vue, qui ne change plus. Voir specs/validation.md#contestation.
 */
export const disputes = sqliteTable('disputes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  questionId: text('question_id')
    .notNull()
    .references(() => questions.id, { onDelete: 'cascade' }),
  status: text('status', { enum: ['pending', 'accepted', 'rejected'] })
    .notNull()
    .default('pending'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  /** Quand l'admin a tranché. Null tant que la contestation attend. */
  settledAt: integer('settled_at', { mode: 'timestamp' }),
}, table => [
  unique('disputes_user_question_unique').on(table.userId, table.questionId),
  index('disputes_status_idx').on(table.status, table.createdAt),
])

/**
 * Une tentative achevée : de la reprise à vies pleines jusqu'à la suivante.
 * Écrite au moment où la tentative d'après s'ouvre — pas à la perte de la
 * dernière vie, qu'une contestation acceptée peut annuler.
 *
 * La longueur d'une tentative se compte en questions vues, l'unité de
 * progression du jeu, et non en heures : une soirée entrecoupée de pauses ne
 * vaut pas une longue ascension. Voir specs/ecrans.md#profil.
 */
export const attempts = sqliteTable('attempts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  startedAt: integer('started_at', { mode: 'timestamp' }).notNull(),
  endedAt: integer('ended_at', { mode: 'timestamp' }).notNull(),
  /** Questions vues pendant la tentative — sa longueur. */
  seen: integer('seen').notNull(),
  /** L'étage où elle s'est achevée. */
  floor: integer('floor').notNull(),
}, table => [index('attempts_user_idx').on(table.userId, table.endedAt)])

/**
 * Une réponse soumise parce que le joueur a quitté la page pendant qu'un timer
 * tournait. Réservé à l'administration : le profil joueur n'en porte aucune
 * trace, et une question résolue ainsi n'est pas contestable.
 * Voir specs/anti-triche.md#perte-de-focus.
 */
export const focusLosses = sqliteTable('focus_losses', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  questionId: text('question_id')
    .notNull()
    .references(() => questions.id, { onDelete: 'cascade' }),
  /** La phase qui servait la question : l'ascension coûte une vie, le rattrapage non. */
  mode: text('mode', { enum: ['ascent', 'recovery'] }).notNull(),
  lostAt: integer('lost_at', { mode: 'timestamp' }).notNull(),
}, table => [index('focus_losses_user_idx').on(table.userId, table.lostAt)])

export type User = typeof users.$inferSelect
export type Whitelist = typeof whitelist.$inferSelect
export type Question = typeof questions.$inferSelect
export type AcceptedAnswer = typeof acceptedAnswers.$inferSelect
export type Category = typeof categories.$inferSelect
export type SeenQuestion = typeof seenQuestions.$inferSelect
export type Reservation = typeof reservations.$inferSelect
export type MissedPoolEntry = typeof missedPool.$inferSelect
export type RecoveryQuestion = typeof recoveryQuestions.$inferSelect
export type Dispute = typeof disputes.$inferSelect
export type Attempt = typeof attempts.$inferSelect
export type FocusLoss = typeof focusLosses.$inferSelect
