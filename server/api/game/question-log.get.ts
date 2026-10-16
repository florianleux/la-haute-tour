import { z } from 'zod'
import { useDatabase } from '~~/server/db/client'
import { requireCamp } from '~~/server/utils/camp'
import { readMissedPool, readQuestionLog } from '~~/server/utils/game'
import { QUESTION_PAGE_SIZE } from '~~/shared/utils/questionLog'
import type { QuestionLogPage } from '~~/server/utils/game'

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  /** L'onglet : le Pool Échecs de l'étage, les questions connues, ou toutes les vues. */
  filter: z.enum(['missed', 'correct', 'all']).default('all'),
})

/**
 * Une page du Volumen, vingt questions. Au camp seulement : le rattrapage tire
 * dans le Pool Échecs, en lire les réponses pendant qu'il tourne serait tricher.
 * Voir specs/ecrans.md#volumen.
 */
export default defineEventHandler(async (event): Promise<QuestionLogPage> => {
  const user = await requireAuth(event)
  const { page, filter } = await getValidatedQuery(event, querySchema.parse)
  const db = useDatabase()
  await requireCamp(db, user, new Date())

  const query = { limit: QUESTION_PAGE_SIZE, offset: (page - 1) * QUESTION_PAGE_SIZE }

  return filter === 'missed'
    ? readMissedPool(db, user, query)
    : readQuestionLog(db, user, { ...query, filter })
})
