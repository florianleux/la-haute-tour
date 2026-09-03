import { z } from 'zod'
import { useDatabase } from '~~/server/db/client'
import { readMissedPool } from '~~/server/utils/game'
import type { MissedPoolPage } from '~~/server/utils/game'

/** Ten at a time, loaded as the player scrolls. See specs/ecrans.md. */
export const POOL_PAGE_SIZE = 10

const querySchema = z.object({
  offset: z.coerce.number().int().min(0).default(0),
  order: z.enum(['asc', 'desc']).default('desc'),
})

export default defineEventHandler(async (event): Promise<MissedPoolPage> => {
  const user = await requireAuth(event)
  const { offset, order } = await getValidatedQuery(event, querySchema.parse)

  return readMissedPool(useDatabase(), user, { limit: POOL_PAGE_SIZE, offset, order })
})
