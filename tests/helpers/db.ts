import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { migrate } from 'drizzle-orm/libsql/migrator'
import * as schema from '../../server/db/schema'
import type { Database } from '../../server/db/client'

/** In-memory SQLite with the migrations applied — one per test. */
export async function createTestDatabase(): Promise<Database> {
  const db = drizzle(createClient({ url: ':memory:' }), { schema })
  await migrate(db, { migrationsFolder: './drizzle' })
  return db
}

type PlayerState = Partial<typeof schema.users.$inferInsert>

/** A player in the database, spelling out only what the test looks at. */
export async function createPlayer(db: Database, state: PlayerState = {}): Promise<number> {
  const [user] = await db
    .insert(schema.users)
    .values({ discordId: '123456789', username: 'gandalf', ...state })
    .returning()

  return user.id
}
