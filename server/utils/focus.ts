import { count, desc, eq, max } from 'drizzle-orm'
import { focusLosses, users } from '../db/schema'
import type { Database } from '../db/client'

/**
 * Les pertes de focus, joueur par joueur. Réservé à l'administration : elles
 * servent à repérer les tricheurs systémiques — dix en cinq questions se
 * remarquent, une par soirée non. Voir specs/anti-triche.md#flags-côté-admin.
 */
export interface FocusLossTally {
  userId: number
  username: string
  /** Combien de fois ce joueur a quitté la page pendant qu'un timer tournait. */
  losses: number
  /** ISO 8601 de la dernière. */
  lastAt: string
}

export async function focusLossTally(db: Database): Promise<FocusLossTally[]> {
  const rows = await db
    .select({
      userId: users.id,
      username: users.username,
      losses: count(focusLosses.id),
      lastAt: max(focusLosses.lostAt),
    })
    .from(focusLosses)
    .innerJoin(users, eq(users.id, focusLosses.userId))
    .groupBy(users.id, users.username)
    .orderBy(desc(count(focusLosses.id)))

  return rows.map(row => ({
    userId: row.userId,
    username: row.username,
    losses: row.losses,
    lastAt: new Date(row.lastAt ?? 0).toISOString(),
  }))
}
