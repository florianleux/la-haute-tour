import { eq } from 'drizzle-orm'
import { useDatabase } from '~~/server/db/client'
import { users } from '~~/server/db/schema'

/**
 * Le joueur a fini l'introduction : elle ne lui sera plus imposée. Le joueur
 * servi par le jeu, comme pour le genre — le joueur test incarné le cas
 * échéant.
 *
 * Réécrit si l'introduction se rejoue : l'heure n'a pas d'autre usage que de
 * dire qu'elle est finie. Voir specs/spec.md (glossaire, « Introduction »).
 */
export default defineEventHandler(async (event): Promise<{ ok: true }> => {
  const user = await requireAuth(event)

  await useDatabase().update(users).set({ introDoneAt: new Date() }).where(eq(users.id, user.id))

  return { ok: true }
})
