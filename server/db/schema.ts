import { sql } from 'drizzle-orm'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

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

export type User = typeof users.$inferSelect
export type Whitelist = typeof whitelist.$inferSelect
