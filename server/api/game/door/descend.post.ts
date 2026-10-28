import { useDatabase } from '~~/server/db/client'
import { descendToCamp } from '~~/server/utils/game'
import type { GameState } from '~~/server/utils/game'

/**
 * « Redescendre » : quitte la porte du boss verrouillée pour attendre au camp,
 * et le serveur s'en souvient. Voir specs/boss.md#attendre-au-camp.
 */
export default defineEventHandler(async (event): Promise<GameState> => {
  const user = await requireAuth(event)

  return descendToCamp(useDatabase(), user, new Date())
})
