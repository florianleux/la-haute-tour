import { defineConfig } from 'drizzle-kit'
import { resolveDatabaseUrl } from './server/db/client'

const url = resolveDatabaseUrl() ?? 'file:./local.db'

export default defineConfig({
  schema: './server/db/schema.ts',
  out: './drizzle',
  dialect: 'turso',
  dbCredentials: {
    url,
    authToken: process.env.TURSO_AUTH_TOKEN,
  },
})
