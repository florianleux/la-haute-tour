import { useDatabase } from '~~/server/db/client'
import { skipCooldown } from '~~/server/utils/lives'
import { requirePlayer } from '~~/server/utils/players'

/**
 * Passer l'attente d'un joueur. La suite se déroule comme si le délai s'était
 * écoulé. Voir specs/admin.md#gestion-des-joueurs.
 */
export default defineEventHandler(async (event): Promise<{ ok: true }> => {
  await requireAdmin(event)

  // Nitro ne route ici que si le segment existe ; le défaut n'est là que pour le typage.
  const id = Number(getRouterParam(event, 'id') ?? '')

  if (!Number.isInteger(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Joueur inconnu' })
  }

  const db = useDatabase()
  await skipCooldown(db, await requirePlayer(db, id), new Date())

  return { ok: true }
})
