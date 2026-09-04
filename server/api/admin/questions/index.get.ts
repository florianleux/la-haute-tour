import { useDatabase } from '~~/server/db/client'
import { floorFilterSchema, listQuestions } from '~~/server/utils/questions'
import type { AdminQuestion } from '~~/server/utils/questions'

export interface AdminQuestionsResponse {
  questions: AdminQuestion[]
}

/** Le deck, filtrable par étage. Admin seulement. Voir specs/admin.md. */
export default defineEventHandler(async (event): Promise<AdminQuestionsResponse> => {
  await requireAdmin(event)

  const { floor } = await getValidatedQuery(event, floorFilterSchema.parse)

  return { questions: await listQuestions(useDatabase(), floor) }
})
