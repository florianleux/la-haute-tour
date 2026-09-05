import { useDatabase } from '~~/server/db/client'
import { openPlayerChest } from '~~/server/utils/game'
import type { GameState } from '~~/server/utils/game'

/**
 * Ouvrir le coffre d'une question loot réussie. Le dé est jeté ici, côté serveur,
 * et son résultat est gravé : le rejouer par un rechargement n'est pas possible.
 * Voir specs/bonus.md#coffre-et-mimic.
 */
export default defineEventHandler(async (event): Promise<GameState> => {
  const user = await requireAuth(event)

  return openPlayerChest(useDatabase(), user, new Date())
})
