import { z } from 'zod'
import { useDatabase } from '~~/server/db/client'
import { requireTestPlayer } from '~~/server/utils/testPlayers'

const bodySchema = z.object({
  /** L'identifiant du joueur test à incarner, ou null pour redevenir soi-même. */
  userId: z.number().int().positive().nullable(),
})

/**
 * Incarner un joueur test, ou mettre fin à l'incarnation. La session garde le
 * compte connecté intact et n'ajoute que la cible : c'est ce qui permet de
 * revenir, l'endpoint restant réservé à l'admin.
 * Voir specs/admin.md#incarnation.
 */
export default defineEventHandler(async (event): Promise<{ ok: true }> => {
  await requireAdmin(event)
  const { userId } = await readValidatedBody(event, bodySchema.parse)

  // Un vrai joueur ne s'incarne pas : ce serait jouer sa partie à sa place.
  if (userId !== null) {
    await requireTestPlayer(useDatabase(), userId)
  }

  const session = await useAuthSession(event)
  await session.update({ actingAsUserId: userId ?? undefined })

  return { ok: true }
})
