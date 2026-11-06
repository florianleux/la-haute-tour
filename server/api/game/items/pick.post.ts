import { useDatabase } from '~~/server/db/client'
import { requireCamp } from '~~/server/utils/camp'
import { pickMushroom } from '~~/server/utils/game'
import type { GameState } from '~~/server/utils/game'

/**
 * Cueillir le Champignon appétissant posé sur le décor du camp. Refusé hors du
 * camp, ou quand aucun ne pousse. Voir specs/champignon.md.
 */
export default defineEventHandler(async (event): Promise<GameState> => {
  const user = await requireAuth(event)
  const db = useDatabase()
  const now = new Date()

  await requireCamp(db, user, now)

  return pickMushroom(db, user, now)
})
