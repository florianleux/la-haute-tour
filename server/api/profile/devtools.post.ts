import { useDatabase } from '~~/server/db/client'
import { unlock } from '~~/server/utils/achievements'
import type { AchievementId } from '~~/shared/utils/achievements'

export interface DevtoolsResponse {
  /** Le succès s'il vient d'être gravé, rien s'il l'était déjà. */
  unlocked: AchievementId[]
}

/**
 * L'écran a vu passer les outils de développement. On le croit sur parole : le
 * succès est sans effet, l'appeler à la main ne rapporte rien.
 * Voir specs/succes.md#clins-dœil.
 */
export default defineEventHandler(async (event): Promise<DevtoolsResponse> => {
  const user = await requireAuth(event)

  return { unlocked: await unlock(useDatabase(), user, ['DEVTOOLS_OPENED'], new Date()) }
})
