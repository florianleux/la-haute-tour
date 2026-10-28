import { useDatabase } from '~~/server/db/client'
import { climbToDoor } from '~~/server/utils/game'
import type { GameState } from '~~/server/utils/game'

/**
 * « Remonter » : quitte le camp pour la porte du boss déverrouillée, et le
 * serveur s'en souvient. Voir specs/boss.md#attendre-au-camp.
 */
export default defineEventHandler(async (event): Promise<GameState> => {
  const user = await requireAuth(event)

  return climbToDoor(useDatabase(), user, new Date())
})
