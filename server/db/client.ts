import type { LibSQLDatabase } from 'drizzle-orm/libsql'
import * as schema from './schema'

export type Database = LibSQLDatabase<typeof schema>

/**
 * Single definition of the env contract, shared with drizzle.config.ts and the
 * startup config check so the three never drift apart.
 */
export function resolveDatabaseUrl(): string | undefined {
  return process.env.TURSO_DATABASE_URL ?? process.env.DATABASE_URL
}

/**
 * `file:` (dev) goes through the node driver, which loads a native binding;
 * Turso (prod, serverless) goes through the web driver, plain HTTP. Both imports
 * are dynamic: otherwise the serverless bundle loads the native binding at
 * startup and crashes before the first request.
 */
export async function createDatabase(): Promise<Database> {
  const url = resolveDatabaseUrl()
  if (!url) {
    throw new Error('DATABASE_URL (ou TURSO_DATABASE_URL) manquant')
  }

  const authToken = process.env.TURSO_AUTH_TOKEN
  const { drizzle } = url.startsWith('file:')
    ? await import('drizzle-orm/libsql/node')
    : await import('drizzle-orm/libsql/web')

  return drizzle({ connection: { url, authToken }, schema })
}

let instance: Database | undefined

/** Set once at startup by `server/plugins/database.ts`. */
export function setDatabase(db: Database): void {
  instance = db
}

export function useDatabase(): Database {
  if (!instance) {
    throw new Error('Base de données non initialisée')
  }
  return instance
}
