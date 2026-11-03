import { useDatabase } from '~~/server/db/client'
import { unlock } from '~~/server/utils/achievements'
import { requireQuill } from '~~/server/utils/items'
import type { AchievementId } from '~~/shared/utils/achievements'

export interface CopyResponse {
  /** Le succès s'il vient d'être gravé, rien s'il l'était déjà. */
  unlocked: AchievementId[]
}

/**
 * Le joueur a copié une question ou une réponse depuis le Volumen, ce que seule
 * la Plume de copiste permet. On le croit sur parole : le succès est sans effet,
 * l'appeler à la main ne rapporte rien.
 * Voir specs/succes.md#clins-dœil.
 */
export default defineEventHandler(async (event): Promise<CopyResponse> => {
  const user = await requireAuth(event)

  const db = useDatabase()
  await requireQuill(db, user.id)

  return { unlocked: await unlock(db, user, ['QUESTION_COPIED'], new Date()) }
})
