import { z } from 'zod'
import { useDatabase } from '~~/server/db/client'
import { submitAnswer } from '~~/server/utils/game'
import type { GameState } from '~~/server/utils/game'

// An empty answer is a legitimate submission — the timer running out, or the page
// being left — and it is simply wrong. See specs/validation.md.
const bodySchema = z.object({
  answer: z.string(),
})

export default defineEventHandler(async (event): Promise<GameState> => {
  const user = await requireAuth(event)
  const { answer } = await readValidatedBody(event, bodySchema.parse)

  return submitAnswer(useDatabase(), user, answer, new Date())
})
