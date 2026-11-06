import { useDatabase } from '~~/server/db/client'
import { grantKey } from '~~/server/utils/bossKeys'
import { playerFromRoute } from '~~/server/utils/players'

/**
 * Donner une clé à un joueur : celle du boss de son étage courant, sans attendre
 * le loot forcé du coffre (#38). Voir specs/admin.md#gestion-des-joueurs.
 */
export default defineEventHandler(async (event): Promise<{ ok: true }> => {
  await requireAdmin(event)

  await grantKey(useDatabase(), await playerFromRoute(event), new Date())

  return { ok: true }
})
