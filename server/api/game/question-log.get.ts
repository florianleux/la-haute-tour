import { z } from 'zod'
import { useDatabase } from '~~/server/db/client'
import { requireCamp } from '~~/server/utils/camp'
import { readMissedPool, readQuestionLog } from '~~/server/utils/game'
import { hasItem, requireQuill } from '~~/server/utils/items'
import { CATEGORY_LABELS } from '~~/shared/utils/categories'
import { QUESTION_LOG_TABS, QUESTION_PAGE_SIZE } from '~~/shared/utils/questionLog'
import type { QuestionLogPage } from '~~/server/utils/game'

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  /** L'onglet : le Pool Échecs, les questions connues, les Sangsues, ou toutes les vues. */
  filter: z.enum(QUESTION_LOG_TABS).default('all'),
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
  // L'onglet Sangsues et les échecs sur la fiche sont ceux du Filet à sangsues.
  const [, hasLeechNet] = await Promise.all([
    requireCamp(db, user, new Date()),
    hasItem(db, user.id, 'LEECH_NET'),
  ])

  // La recherche et le filtre de catégorie sont ceux de la Plume de copiste.
  if (q || category) {
    await requireQuill(db, user.id)
  }

  if (filter === 'leeches' && !hasLeechNet) {
    throw createError({ statusCode: 403, statusMessage: 'Il faut le Filet à sangsues' })
  }

  const query = { limit: QUESTION_PAGE_SIZE, offset: (page - 1) * QUESTION_PAGE_SIZE, search: q, category, hasLeechNet }

  return filter === 'missed'
    ? readMissedPool(db, user, query)
    : readQuestionLog(db, user, { ...query, filter })
})
