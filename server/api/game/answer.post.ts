import { z } from 'zod'
import { useDatabase } from '~~/server/db/client'
import { submitAnswer } from '~~/server/utils/game'
import type { GameState } from '~~/server/utils/game'

// An empty answer is a legitimate submission — the timer running out, or the page
// being left — and it is simply wrong. See specs/validation.md. Trimmed at the
// boundary: an answer made of spaces is an empty one for everything downstream,
// disputes and achievements included.
const bodySchema = z.object({
  answer: z.string().trim(),
  /**
   * Qui envoie : le joueur, ou son départ de la page. Le client le dit ; le
   * serveur en fait un flag d'administration, pas une sanction supplémentaire.
   * Voir specs/anti-triche.md#perte-de-focus.
   */
  source: z.enum(['player', 'focusLoss']).optional(),
})

export default defineEventHandler(async (event): Promise<GameState> => {
  const user = await requireAuth(event)
  const { answer, source } = await readValidatedBody(event, bodySchema.parse)

  return submitAnswer(useDatabase(), user, answer, new Date(), source)
})
