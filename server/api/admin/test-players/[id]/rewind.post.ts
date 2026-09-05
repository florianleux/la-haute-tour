import { z } from 'zod'
import { useDatabase } from '~~/server/db/client'
import { rewindTestPlayer, testPlayerFromRoute } from '~~/server/utils/testPlayers'

const bodySchema = z.object({ count: z.number().int().min(1).max(500) })

/** Effacer les derniers passages d'un joueur test, pour revenir en arrière. */
export default defineEventHandler(async (event): Promise<{ ok: true }> => {
  await requireAdmin(event)
  const { count } = await readValidatedBody(event, bodySchema.parse)

  await rewindTestPlayer(useDatabase(), await testPlayerFromRoute(event), count)

  return { ok: true }
})
