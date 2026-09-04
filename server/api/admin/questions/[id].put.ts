import { useDatabase } from '~~/server/db/client'
import { editQuestion, questionEditSchema } from '~~/server/utils/questions'
import type { AdminQuestion } from '~~/server/utils/questions'

/**
 * Le contenu d'une question. L'étage n'en fait pas partie : la répartition en 6
 * étages appartient au script d'import. Voir specs/admin.md#gestion-des-questions.
 */
export default defineEventHandler(async (event): Promise<AdminQuestion> => {
  await requireAdmin(event)

  // Nitro ne route ici que si le segment existe ; le défaut n'est là que pour le typage.
  const id = getRouterParam(event, 'id') ?? ''
  const edit = await readValidatedBody(event, questionEditSchema.parse)

  const updated = await editQuestion(useDatabase(), id, edit)

  if (!updated) {
    throw createError({ statusCode: 404, statusMessage: 'Question introuvable' })
  }

  return updated
})
