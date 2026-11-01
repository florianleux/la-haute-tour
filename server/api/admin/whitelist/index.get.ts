import { desc, eq } from 'drizzle-orm'
import { useDatabase } from '~~/server/db/client'
import { users, whitelist } from '~~/server/db/schema'
import type { TeamId } from '~~/shared/utils/teams'
export interface WhitelistEntry {
  discordId: string
  /** L'équipe d'arrivée, null quand l'admin n'en a pas choisi. */
  team: TeamId | null
  /** Le pseudo Discord, connu dès que le joueur s'est connecté une fois ; null avant. */
  username: string | null
  /** ISO 8601: a `Date` doesn't survive the trip to the client. */
  createdAt: string
  /** L'admin qui lit la liste : il ne peut pas se retirer. Voir [discordId].delete.ts. */
  self: boolean
}

export interface WhitelistResponse {
  entries: WhitelistEntry[]
}

export default defineEventHandler(async (event): Promise<WhitelistResponse> => {
  const admin = await requireAdmin(event)

  const rows = await useDatabase()
    .select({ entry: whitelist, username: users.username })
    .from(whitelist)
    .leftJoin(users, eq(users.discordId, whitelist.discordId))
    .orderBy(desc(whitelist.createdAt))

  return {
    entries: rows.map(({ entry, username }) => ({
      discordId: entry.discordId,
      team: entry.team,
      username,
      createdAt: entry.createdAt.toISOString(),
      self: entry.discordId === admin.discordId,
    })),
  }
})
