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
 * Admin seulement, et pour soi-même : il n'y a pas d'userId dans la route, le
 * joueur concerné est le signé. L'onglet Joueurs vise les autres.
 * Voir specs/admin.md.
 */
export default defineEventHandler(async (event): Promise<GameState> => {
  const user = await requireAdmin(event)
  const db = useDatabase()
  const now = new Date()

  await skipCooldown(db, user, now)

  // La lecture recharge le joueur : c'est l'écriture ci-dessus qu'elle voit.
  return readGameState(db, user, now)
})
