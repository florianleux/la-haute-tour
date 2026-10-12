import { useDatabase } from '~~/server/db/client'
import { disputableErrors } from '~~/server/utils/disputes'
import type { DisputableError } from '~~/server/utils/disputes'

export interface DisputableResponse {
  errors: DisputableError[]
}

/**
 * Les erreurs que le joueur peut encore contester. Lecture sans effet : elle
 * n'ouvre rien. Voir specs/validation.md#contestation.
 */
export default defineEventHandler(async (event): Promise<DisputableResponse> => {
  const user = await requireAuth(event)

  return { errors: await disputableErrors(useDatabase(), user) }
})
