import { desc } from 'drizzle-orm'
import { useDatabase } from '~~/server/db/client'
import { whitelist } from '~~/server/db/schema'
export interface WhitelistEntry {
  discordId: string
  /** ISO 8601: a `Date` doesn't survive the trip to the client. */
  createdAt: string
}

export interface WhitelistResponse {
  entries: WhitelistEntry[]
}

export default defineEventHandler(async (event): Promise<WhitelistResponse> => {
  await requireAdmin(event)

  const rows = await useDatabase()
    .select()
    .from(whitelist)
    .orderBy(desc(whitelist.createdAt))

  return {
    entries: rows.map(row => ({
      discordId: row.discordId,
      createdAt: row.createdAt.toISOString(),
    })),
  }
})
