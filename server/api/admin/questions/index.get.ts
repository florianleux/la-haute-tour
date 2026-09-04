import { useDatabase } from '~~/server/db/client'
import { listQuestions, questionsQuerySchema } from '~~/server/utils/questions'
import type { AdminQuestion } from '~~/server/utils/questions'

export interface AdminQuestionsResponse {
  questions: AdminQuestion[]
  total: number
}

/** Le deck, filtrable par étage et cherchable, paginé par dix. Admin seulement. */
export default defineEventHandler(async (event): Promise<AdminQuestionsResponse> => {
  await requireAdmin(event)

  const parsed = await getValidatedQuery(event, questionsQuerySchema.parse)
  const limit = parsed.limit
  const offset = (parsed.page - 1) * limit

  const { questions, total } = await listQuestions(useDatabase(), {
    floor: parsed.floor,
    search: parsed.search,
    limit,
    offset,
  })

  return { questions, total }
})
