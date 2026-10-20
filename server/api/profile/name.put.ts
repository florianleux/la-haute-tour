import { z } from 'zod'
import { useDatabase } from '~~/server/db/client'
import { users } from '~~/server/db/schema'
import { introUnfinished } from '~~/server/utils/intro'
import { ADVENTURER_NAME_MAX_LENGTH } from '~~/shared/utils/adventurerName'

const bodySchema = z.object({
  name: z.string().trim().min(1).max(ADVENTURER_NAME_MAX_LENGTH),
})

/**
 * Garder le nom que le joueur vient de donner à L'Inconnu. Réécrit tant que
 * l'introduction n'est pas finie (voir server/utils/intro.ts), effacé par la
 * remise à zéro. Voir specs/spec.md (glossaire, « Nom d'aventurier »).
 */
export default defineEventHandler(async (event): Promise<{ ok: true }> => {
  const user = await requireAuth(event)
  const { name } = await readValidatedBody(event, bodySchema.parse)

  await useDatabase()
    .update(users)
    .set({ adventurerName: name })
    .where(introUnfinished(user.id))

  return { ok: true }
})
