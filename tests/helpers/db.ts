import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { migrate } from 'drizzle-orm/libsql/migrator'
import * as schema from '../../server/db/schema'
import type { Database } from '../../server/db/client'

/** Base SQLite en mémoire, migrations appliquées — une par test. */
export async function createTestDatabase(): Promise<Database> {
  const db = drizzle(createClient({ url: ':memory:' }), { schema })
  await migrate(db, { migrationsFolder: './drizzle' })
  return db
}
