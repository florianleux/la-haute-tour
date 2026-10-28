import { and, eq, isNotNull, isNull, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/sqlite-core'
import { KEYS_TO_UNLOCK } from '../../shared/utils/bossKeys'
import { bossKeys, users } from '../db/schema'
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

/**
 * Qui a posé sa clé sur la porte du joueur, dans l'ordre de pose : la porte est
 * celle de son équipe et de son étage. Les joueurs test n'y croisent que des
 * joueurs test, leur monde est scellé. Voir ADR 0008.
 */
function buildKeyHoldersQuery(db: Database, userId: number) {
  const holder = alias(users, 'holder')
  return db
    .select({ username: holder.username })
    .from(bossKeys)
    .innerJoin(holder, eq(holder.id, bossKeys.userId))
    .innerJoin(users, and(
      eq(users.id, userId),
      eq(holder.team, users.team),
      eq(holder.isTest, users.isTest),
      eq(bossKeys.floor, users.currentFloor),
    ))
    .where(isNotNull(bossKeys.placedAt))
    .orderBy(bossKeys.placedAt, bossKeys.userId)
}

type KeyHoldersQuery = ReturnType<typeof buildKeyHoldersQuery>

export function keyHoldersQuery(db: Database, userId: number): KeyHoldersQuery {
  return buildKeyHoldersQuery(db, userId)
}

/**
 * Poser la clé du joueur dans une serrure de la porte de son équipe. Une seule
 * écriture, gardée par ce qu'elle vérifie : la clé pas encore posée, et moins
 * de deux clés déjà posées — comptées par la requête même qui les nomme. Deux
 * requêtes simultanées ne posent ainsi ni deux fois la même clé, ni une
 * troisième. Sans équipe, rien ne se compte : la porte est déjà déverrouillée.
 * Voir specs/boss.md#poser-la-clé.
 */
export async function placeKeyIfRoom(db: Database, player: User, now: Date): Promise<void> {
  await db
    .update(bossKeys)
    .set({ placedAt: now })
    .where(and(
      eq(bossKeys.userId, player.id),
      eq(bossKeys.floor, player.currentFloor),
      isNull(bossKeys.placedAt),
      sql`(select count(*) from (${keyHoldersQuery(db, player.id)})) < ${KEYS_TO_UNLOCK}`,
    ))
}
