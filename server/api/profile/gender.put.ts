import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { useDatabase } from '~~/server/db/client'
import { users } from '~~/server/db/schema'
import { GENDERS } from '~~/shared/utils/genders'

const bodySchema = z.object({
  gender: z.enum(GENDERS),
})

/**
 * Garder le genre que le joueur vient de donner à L'Inconnu. Le joueur servi par
 * le jeu, donc le joueur test incarné le cas échéant : c'est lui qui joue
 * l'introduction.
 *
 * Réécrit à chaque réponse plutôt que fixé à la première : l'introduction ne vit
 * encore qu'en banc de design (`/test/intro`), où elle se rejoue. Voir
 * specs/spec.md (glossaire, « Genre »).
 */
export default defineEventHandler(async (event): Promise<{ ok: true }> => {
  const user = await requireAuth(event)
  const { gender } = await readValidatedBody(event, bodySchema.parse)

  await useDatabase().update(users).set({ gender }).where(eq(users.id, user.id))

  return { ok: true }
})
