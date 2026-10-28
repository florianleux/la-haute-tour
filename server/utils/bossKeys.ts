import { bossKeys } from '../db/schema'
import type { Database } from '../db/client'
import type { User } from '../db/schema'

/**
 * Donner au joueur la clé du boss de son étage courant. Sans effet s'il l'a
 * déjà : une clé au plus par joueur et par étage. Voir specs/boss.md#obtention-de-la-clé.
 */
export async function grantKey(db: Database, player: User, now: Date): Promise<void> {
  await db
    .insert(bossKeys)
    .values({ userId: player.id, floor: player.currentFloor, obtainedAt: now })
    .onConflictDoNothing()
}
