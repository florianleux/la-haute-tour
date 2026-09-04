import { useDatabase } from '~~/server/db/client'
import { removeQuestion } from '~~/server/utils/questions'

export default defineEventHandler(async (event): Promise<{ ok: true }> => {
  await requireAdmin(event)

  // Nitro ne route ici que si le segment existe ; le défaut n'est là que pour le typage.
  const id = getRouterParam(event, 'id') ?? ''

  if (!await removeQuestion(useDatabase(), id)) {
    throw createError({ statusCode: 404, statusMessage: 'Question introuvable' })
  }

  return { ok: true }
})
