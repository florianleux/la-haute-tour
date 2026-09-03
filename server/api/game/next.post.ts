import { useDatabase } from '~~/server/db/client'
import { serveNextQuestion } from '~~/server/utils/game'
import type { GameState } from '~~/server/utils/game'

/**
 * Start, or move on to the next question. The player's own move — this is the only
 * thing that ever reserves a question. See specs/mecanique.md.
 */
export default defineEventHandler(async (event): Promise<GameState> => {
  const user = await requireAuth(event)

  return serveNextQuestion(useDatabase(), user, new Date())
})
