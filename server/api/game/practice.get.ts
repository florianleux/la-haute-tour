import { practiceQuestion } from '~~/server/utils/practice'
import type { PracticeQuestion } from '~~/server/utils/practice'

/** La question d'essai de la leçon du camp, à afficher. Ne réserve rien, ne démarre aucun chrono. */
export default defineEventHandler(async (event): Promise<PracticeQuestion> => {
  const user = await requireAuth(event)

  return practiceQuestion(user)
})
