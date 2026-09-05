import { useDatabase } from '~~/server/db/client'
import { maintenanceSince } from '~~/server/utils/maintenance'
import type { MaintenanceResponse } from './maintenance.post'


/** Si le jeu est fermé aux joueurs, et depuis quand. Voir specs/admin.md#maintenance. */
export default defineEventHandler(async (event): Promise<MaintenanceResponse> => {
  await requireAdmin(event)

  return { since: (await maintenanceSince(useDatabase()))?.toISOString() ?? null }
})
