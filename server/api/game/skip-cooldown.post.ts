import { eq } from 'drizzle-orm'
import { useDatabase } from '~~/server/db/client'
import { users } from '~~/server/db/schema'
import { readGameState } from '~~/server/utils/game'
import type { GameState } from '~~/server/utils/game'

/**
 * L'admin passe sa propre attente : le `cooldownUntil` est effacé, les vies
 * restent à zéro, donc la phase devient `recovery` (ou `ascent` si le pool est
 * trop maigre pour un rattrapage — la reprise joue alors sans rattrapage).
 *
 * Admin seulement, et pour soi-même : il n'y a pas d'userId dans la route, le
 * joueur concerné est le signé. Voir specs/admin.md.
 */
export default defineEventHandler(async (event): Promise<GameState> => {
  const user = await requireAdmin(event)
  const db = useDatabase()

  await db
    .update(users)
    .set({ cooldownUntil: null })
    .where(eq(users.id, user.id))

  return readGameState(db, user, new Date())
})
