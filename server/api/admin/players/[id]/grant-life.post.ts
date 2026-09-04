import { useDatabase } from '~~/server/db/client'
import { grantLife } from '~~/server/utils/lives'
import { requirePlayer } from '~~/server/utils/players'

/**
 * Rendre une vie à un joueur. Même geste que celui d'une contestation acceptée :
 * sans plafond, et sans vie restante il annule l'attente en cours.
 * Voir specs/admin.md#gestion-des-joueurs.
 */
export default defineEventHandler(async (event): Promise<{ ok: true }> => {
  await requireAdmin(event)

  // Nitro ne route ici que si le segment existe ; le défaut n'est là que pour le typage.
  const id = Number(getRouterParam(event, 'id') ?? '')

  if (!Number.isInteger(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Joueur inconnu' })
  }

  const db = useDatabase()
  await grantLife(db, await requirePlayer(db, id))

  return { ok: true }
})
