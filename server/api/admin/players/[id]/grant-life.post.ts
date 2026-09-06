import { useDatabase } from '~~/server/db/client'
import { grantLife } from '~~/server/utils/lives'
import { playerFromRoute } from '~~/server/utils/players'

/**
 * Rendre une vie à un joueur. Même geste que celui d'une contestation acceptée :
 * sans plafond, et sans vie restante il annule l'attente en cours.
 * Voir specs/admin.md#gestion-des-joueurs.
 */
export default defineEventHandler(async (event): Promise<{ ok: true }> => {
  await requireAdmin(event)

  await grantLife(useDatabase(), await playerFromRoute(event))

  return { ok: true }
})
