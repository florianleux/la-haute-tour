import { useDatabase } from '~~/server/db/client'
import { readAchievements } from '~~/server/utils/achievements'
import type { UnlockedAchievement } from '~~/server/utils/achievements'

export interface AchievementsResponse {
  unlocked: UnlockedAchievement[]
}

/**
 * Les succès du joueur signé, et de lui seul : il n'y a pas d'identifiant dans la
 * route, et aucun palmarès ne se lit d'ailleurs que du sien.
 *
 * Seul l'acquis voyage. Le catalogue complet vit côté écran, où sont déjà les
 * libellés et les conditions : l'envoyer à chaque lecture ferait traverser
 * tout le catalogue, qui ne change jamais. Voir specs/succes.md#affichage.
 */
export default defineEventHandler(async (event): Promise<AchievementsResponse> => {
  const user = await requireAuth(event)

  return { unlocked: await readAchievements(useDatabase(), user) }
})
