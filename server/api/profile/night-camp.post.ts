import { useDatabase } from '~~/server/db/client'
import { unlock } from '~~/server/utils/achievements'
import { isNight } from '~~/shared/utils/time'
import type { AchievementId } from '~~/shared/utils/achievements'

export interface NightCampResponse {
  /** Le succès s'il vient d'être gravé, rien s'il l'était déjà, ou s'il fait jour. */
  unlocked: AchievementId[]
}

/**
 * L'écran affiche le camp. Il ne se juge pas de l'heure : c'est celle du serveur
 * qui décide s'il fait nuit. Voir specs/succes.md#clins-dœil.
 */
export default defineEventHandler(async (event): Promise<NightCampResponse> => {
  const user = await requireAuth(event)
  const now = new Date()

  return { unlocked: isNight(now) ? await unlock(useDatabase(), user, ['CAMP_AT_NIGHT'], now) : [] }
})
