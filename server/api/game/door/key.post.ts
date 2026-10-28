import { useDatabase } from '~~/server/db/client'
import { placeKey } from '~~/server/utils/game'
import type { GameState } from '~~/server/utils/game'

/**
 * « Utiliser la clé de la Lune » : pose la clé du joueur sur la porte
 * verrouillée de son équipe. Voir specs/boss.md#poser-la-clé.
 */
export default defineEventHandler(async (event): Promise<GameState> => {
  const user = await requireAuth(event)

  return placeKey(useDatabase(), user, new Date())
})
