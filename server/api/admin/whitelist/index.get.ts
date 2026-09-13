import { desc } from 'drizzle-orm'
import { useDatabase } from '~~/server/db/client'
import { whitelist } from '~~/server/db/schema'
import type { TeamId } from '~~/shared/utils/teams'
export interface WhitelistEntry {
  discordId: string
  /** L'équipe d'arrivée, null quand l'admin n'en a pas choisi. */
  team: TeamId | null
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
      team: row.team,
      createdAt: row.createdAt.toISOString(),
    })),
  }
})
