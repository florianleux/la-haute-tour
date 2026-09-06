import { useDatabase } from '~~/server/db/client'
import { skipCooldown } from '~~/server/utils/lives'
import { playerFromRoute } from '~~/server/utils/players'

/**
 * Passer l'attente d'un joueur. La suite se déroule comme si le délai s'était
 * écoulé. Voir specs/admin.md#gestion-des-joueurs.
 */
export default defineEventHandler(async (event): Promise<{ ok: true }> => {
  await requireAdmin(event)

  await skipCooldown(useDatabase(), await playerFromRoute(event), new Date())

  return { ok: true }
})
