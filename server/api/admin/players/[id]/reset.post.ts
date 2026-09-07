import { useDatabase } from '~~/server/db/client'
import { playerFromRoute, resetPlayer } from '~~/server/utils/players'

/**
 * Effacer la partie d'un joueur et le rendre neuf : étage 1, vies pleines.
 * Voir specs/admin.md#gestion-des-joueurs.
 */
export default defineEventHandler(async (event): Promise<{ ok: true }> => {
  await requireAdmin(event)

  await resetPlayer(useDatabase(), await playerFromRoute(event), new Date())

  return { ok: true }
})
