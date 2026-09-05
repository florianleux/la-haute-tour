import { z } from 'zod'
import { useDatabase } from '~~/server/db/client'
import { maintenanceSince, setMaintenance } from '~~/server/utils/maintenance'

const bodySchema = z.object({ closed: z.boolean() })

export interface MaintenanceResponse {
  /** Depuis quand le jeu est fermé, en ISO 8601. Null quand il est ouvert. */
  since: string | null
}

/**
 * Fermer ou rouvrir le jeu aux joueurs. Les admins continuent de jouer.
 * Voir specs/admin.md#maintenance.
 */
export default defineEventHandler(async (event): Promise<MaintenanceResponse> => {
  await requireAdmin(event)

  const { closed } = bodySchema.parse(await readBody(event))
  const db = useDatabase()

  await setMaintenance(db, closed, new Date())

  return { since: (await maintenanceSince(db))?.toISOString() ?? null }
})
