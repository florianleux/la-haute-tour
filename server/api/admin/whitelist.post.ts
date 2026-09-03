import { z } from 'zod'
import { useDatabase } from '~~/server/db/client'
import { whitelist } from '~~/server/db/schema'

// A Discord ID is a snowflake: digits only. Refusing anything else keeps a typo
// or a pasted @username out of a list that would silently never match.
const bodySchema = z.object({
  discordId: z.string().trim().regex(/^\d+$/),
})

export default defineEventHandler(async (event): Promise<{ ok: true }> => {
  await requireAdmin(event)

  const { discordId } = await readValidatedBody(event, bodySchema.parse)

  // Adding an ID already on the list is not a mistake worth an error: the list
  // ends up as asked either way.
  await useDatabase()
    .insert(whitelist)
    .values({ discordId })
    .onConflictDoNothing()

  return { ok: true }
})
