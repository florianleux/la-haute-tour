import { useDatabase } from '~~/server/db/client'
import { addQuestion, questionDraftSchema } from '~~/server/utils/questions'
import type { AdminQuestion } from '~~/server/utils/questions'

export default defineEventHandler(async (event): Promise<AdminQuestion> => {
  await requireAdmin(event)

  const draft = await readValidatedBody(event, questionDraftSchema.parse)

  return addQuestion(useDatabase(), draft)
})
