import { and, eq, isNull } from 'drizzle-orm'
import { users } from '../db/schema'
import type { SQL } from 'drizzle-orm'

/**
 * Ce joueur, tant qu'il n'a pas fini l'introduction : la condition de toute
 * écriture qu'elle fait. Ses réponses (nom, genre) se réécrivent jusque-là, puis
 * se figent — l'admin qui la relit ne change rien à la partie du joueur servi.
 * Voir specs/spec.md (glossaire, « Introduction »).
 */
export function introUnfinished(userId: number): SQL | undefined {
  return and(eq(users.id, userId), isNull(users.introDoneAt))
}
