import { z } from 'zod'
import { useDatabase } from '~~/server/db/client'
import { requireCamp } from '~~/server/utils/camp'
import { readMissedPool, readQuestionLog } from '~~/server/utils/game'
import { requireQuill } from '~~/server/utils/items'
import { CATEGORY_LABELS } from '~~/shared/utils/categories'
import { QUESTION_PAGE_SIZE } from '~~/shared/utils/questionLog'
import type { QuestionLogPage } from '~~/server/utils/game'

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  /** L'onglet : le Pool Échecs de l'étage, les questions connues, ou toutes les vues. */
  filter: z.enum(['missed', 'correct', 'all']).default('all'),
  /** Du texte libre, cherché dans l'énoncé et la réponse. */
  q: z.string().trim().max(100).optional(),
  /** Le code d'une catégorie du deck. */
  category: z.enum(Object.keys(CATEGORY_LABELS) as [string, ...string[]]).optional(),
})

/**
 * Une page du Volumen, vingt questions. Au camp seulement : le rattrapage tire
 * dans le Pool Échecs, en lire les réponses pendant qu'il tourne serait tricher.
 * Voir specs/ecrans.md#volumen.
 */
export default defineEventHandler(async (event): Promise<QuestionLogPage> => {
  const user = await requireAuth(event)
  const { page, filter, q, category } = await getValidatedQuery(event, querySchema.parse)
  const db = useDatabase()
  await requireCamp(db, user, new Date())

  // La recherche et le filtre de catégorie sont ceux de la Plume de copiste.
  if (q || category) {
    await requireQuill(db, user.id)
  }

  const query = { limit: QUESTION_PAGE_SIZE, offset: (page - 1) * QUESTION_PAGE_SIZE, search: q, category }

  return filter === 'missed'
    ? readMissedPool(db, user, query)
    : readQuestionLog(db, user, { ...query, filter })
})
