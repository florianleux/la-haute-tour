import { eq } from 'drizzle-orm'
import { useDatabase } from '~~/server/db/client'
import { flags } from '~~/server/db/schema'
import type { Flag } from '~~/server/db/schema'

/** Ce que le banc montre d'un drapeau : l'image, et de quoi juger la saisie. Jamais le slug, qui dit la réponse. */
export type BossFlag = Pick<Flag, 'image' | 'answerLabel' | 'acceptedAnswers'>

export interface BossFlagsResponse {
  flags: BossFlag[]
}

/**
 * Les drapeaux du premier combat contre le boss de l'étage 1, réponses
 * comprises, pour son banc (pages/test/boss/1.vue). Admin seulement.
 *
 * Servis d'ici plutôt qu'importés par la page : tout ce qu'une page importe
 * part dans un fichier JS que n'importe qui télécharge, connecté ou non — les
 * réponses du boss y étaient lisibles. Voir docs/revue-de-securite.md.
 */
export default defineEventHandler(async (event): Promise<BossFlagsResponse> => {
  await requireAdmin(event)

  return {
    flags: await useDatabase()
      .select({ image: flags.image, answerLabel: flags.answerLabel, acceptedAnswers: flags.acceptedAnswers })
      .from(flags)
      .where(eq(flags.bossAttemptNumber, 1)),
  }
})
