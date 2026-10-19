import { z } from 'zod'
import { and, eq, isNull } from 'drizzle-orm'
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
 * Réécrit à chaque réponse tant que l'introduction n'est pas finie : quittée
 * avant la fin, elle reprend du début. Finie, plus rien ne l'écrit — l'admin
 * qui la relit ne change rien à la partie du joueur servi. La remise à zéro
 * l'efface et rouvre l'introduction. Voir specs/spec.md (glossaire, « Genre »
 * et « Introduction »).
 */
export default defineEventHandler(async (event): Promise<{ ok: true }> => {
  const user = await requireAuth(event)
  const { gender } = await readValidatedBody(event, bodySchema.parse)

  await useDatabase()
    .update(users)
    .set({ gender })
    .where(and(eq(users.id, user.id), isNull(users.introDoneAt)))

  return { ok: true }
})
