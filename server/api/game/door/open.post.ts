import { useDatabase } from '~~/server/db/client'
import { openDoor } from '~~/server/utils/game'
import type { GameState } from '~~/server/utils/game'

/**
 * « Ouvrir » : écarte les battants de la porte du boss déverrouillée, et le
 * serveur s'en souvient. Voir specs/boss.md#arriver-devant-la-porte.
 */
export default defineEventHandler(async (event): Promise<GameState> => {
  const user = await requireAuth(event)

  return openDoor(useDatabase(), user, new Date())
})
