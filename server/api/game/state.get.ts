import { useDatabase } from '~~/server/db/client'
import { readGameState } from '~~/server/utils/game'
import type { GameState } from '~~/server/utils/game'

/**
 * Where the player stands. The single read endpoint of the game state, and it has
 * no effect: it draws no question and starts no clock. See specs/architecture.md.
 */
export default defineEventHandler(async (event): Promise<GameState> => {
  const user = await requireAuth(event)

  return readGameState(useDatabase(), user, new Date())
})
