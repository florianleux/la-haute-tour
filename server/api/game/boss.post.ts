import { useDatabase } from '~~/server/db/client'
import { enterBoss } from '~~/server/utils/game'
import type { GameState } from '~~/server/utils/game'

/**
 * « Entrer » : ouvre le combat de boss, au terme de la porte et de
 * l'introduction. Sans effet ailleurs qu'au palier. Voir specs/boss.md.
 */
export default defineEventHandler(async (event): Promise<GameState> => {
  const user = await requireAuth(event)

  return enterBoss(useDatabase(), user, new Date())
})
