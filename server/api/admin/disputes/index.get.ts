import { useDatabase } from '~~/server/db/client'
import { pendingDisputes } from '~~/server/utils/disputes'
import type { PendingDispute } from '~~/server/utils/disputes'

export interface PendingDisputesResponse {
  disputes: PendingDispute[]
}

/** La file d'arbitrage, visible dès la connexion de l'admin. Voir specs/admin.md. */
export default defineEventHandler(async (event): Promise<PendingDisputesResponse> => {
  await requireAdmin(event)

  return { disputes: await pendingDisputes(useDatabase()) }
})
