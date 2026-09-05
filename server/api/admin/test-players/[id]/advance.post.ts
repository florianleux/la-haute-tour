import { z } from 'zod'
import { useDatabase } from '~~/server/db/client'
import { advanceTestPlayer, testPlayerFromRoute } from '~~/server/utils/testPlayers'

const bodySchema = z.object({
  count: z.number().int().min(1).max(500),
  correct: z.boolean(),
})

/** Avancer un joueur test dans son étage, en justes ou en fausses. */
export default defineEventHandler(async (event): Promise<{ ok: true }> => {
  await requireAdmin(event)
  const options = await readValidatedBody(event, bodySchema.parse)

  await advanceTestPlayer(useDatabase(), await testPlayerFromRoute(event), options, new Date())

  return { ok: true }
})
