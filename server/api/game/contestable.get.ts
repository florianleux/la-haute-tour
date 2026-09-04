import { useDatabase } from '~~/server/db/client'
import { contestableErrors } from '~~/server/utils/disputes'
import type { ContestableError } from '~~/server/utils/disputes'

export interface ContestableResponse {
  errors: ContestableError[]
}

/**
 * Les erreurs que le joueur peut encore contester. Lecture sans effet : elle
 * n'ouvre rien. Voir specs/validation.md#contestation.
 */
export default defineEventHandler(async (event): Promise<ContestableResponse> => {
  const user = await requireAuth(event)

  return { errors: await contestableErrors(useDatabase(), user) }
})
