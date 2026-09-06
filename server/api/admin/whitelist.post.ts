import { z } from 'zod'
import { useDatabase } from '~~/server/db/client'
import { whitelist } from '~~/server/db/schema'
import { TEAM_IDS } from '~~/shared/utils/teams'

// A Discord ID is a snowflake: digits only. Refusing anything else keeps a typo
// or a pasted @username out of a list that would silently never match.
const bodySchema = z.object({
  discordId: z.string().trim().regex(/^\d+$/),
  /** L'équipe d'arrivée, ou null pour laisser le joueur sans équipe. */
  team: z.enum(TEAM_IDS).nullable().default(null),
})

export default defineEventHandler(async (event): Promise<{ ok: true }> => {
  await requireAdmin(event)

  const { discordId, team } = await readValidatedBody(event, bodySchema.parse)

  // Ré-ajouter un ID déjà listé n'est pas une faute : la liste finit comme
  // demandée dans les deux cas, et l'équipe d'arrivée se corrige ainsi tant que
  // le joueur ne s'est pas connecté.
  await useDatabase()
    .insert(whitelist)
    .values({ discordId, team })
    .onConflictDoUpdate({ target: whitelist.discordId, set: { team } })

  return { ok: true }
})
