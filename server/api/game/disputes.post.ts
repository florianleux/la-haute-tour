import { z } from 'zod'
import { useDatabase } from '~~/server/db/client'
import { openDispute } from '~~/server/utils/disputes'
import type { AchievementId } from '~~/shared/utils/achievements'

const bodySchema = z.object({
  questionId: z.string().min(1),
})

/** Le joueur conteste une question qu'il estime avoir eue juste. Bouton seul, pas de message. */
export default defineEventHandler(async (event): Promise<{ unlocked: AchievementId[] }> => {
  const user = await requireAuth(event)
  const { questionId } = await readValidatedBody(event, bodySchema.parse)

  return { unlocked: await openDispute(useDatabase(), user, questionId, new Date()) }
})
