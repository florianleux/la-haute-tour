import { useDatabase } from '~~/server/db/client'
import { readGameState } from '~~/server/utils/game'
import { skipCooldown } from '~~/server/utils/lives'
import type { GameState } from '~~/server/utils/game'

/**
 * L'admin passe sa propre attente : l'échéance tombe dans le passé, les vies
 * restent à zéro, donc la phase devient `recovery` — ou `ascent` si le Pool
 * Échecs est trop maigre pour tirer un rattrapage, la lecture rendant alors les
 * vies comme pour une attente écoulée d'elle-même.
 *
 * Admin seulement, et pour la partie qu'il a sous les yeux : il n'y a pas
 * d'userId dans la route. La garde lit le compte connecté, la cible est le
 * joueur servi — les deux diffèrent quand l'admin incarne un joueur test, et
 * c'est bien l'attente de ce dernier qu'il faut passer.
 * Voir specs/admin.md et specs/admin.md#incarnation.
 */
export default defineEventHandler(async (event): Promise<GameState> => {
  await requireAdmin(event)
  const user = await requireAuth(event)
  const db = useDatabase()
  const now = new Date()

  await skipCooldown(db, user, now)

  // La lecture recharge le joueur : c'est l'écriture ci-dessus qu'elle voit.
  return readGameState(db, user, now)
})
