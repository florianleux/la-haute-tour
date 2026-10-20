import { z } from 'zod'
import { judgePractice } from '~~/server/utils/practice'
import type { Verdict } from '~~/server/utils/game'

// Comme une vraie réponse : vide, c'est le chrono tombé à zéro. Voir answer.post.ts.
const bodySchema = z.object({ answer: z.string().trim() })

/** Juge la question d'essai, sans rien écrire de la partie. Voir server/utils/practice.ts. */
export default defineEventHandler(async (event): Promise<Verdict> => {
  await requireAuth(event)
  const { answer } = await readValidatedBody(event, bodySchema.parse)

  return judgePractice(answer)
})
