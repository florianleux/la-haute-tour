import { sql } from 'drizzle-orm'
import { check, index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'

/** Étages 1-2 = difficulté 1, 3-4 = difficulté 2, 5-6 = difficulté 3. */
export const FLOOR_COUNT = 6

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
  isAdmin: integer('is_admin', { mode: 'boolean' }).notNull().default(false),
  currentFloor: integer('current_floor').notNull().default(1),
  lives: integer('lives').notNull().default(3),
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

export type User = typeof users.$inferSelect
export type Whitelist = typeof whitelist.$inferSelect
export type Question = typeof questions.$inferSelect
export type AcceptedAnswer = typeof acceptedAnswers.$inferSelect
export type Category = typeof categories.$inferSelect
