import { and, eq, isNotNull, isNull, sql } from 'drizzle-orm'
import type { SQL, SQLWrapper } from 'drizzle-orm'
import { alias } from 'drizzle-orm/sqlite-core'
import { KEYS_TO_UNLOCK } from '../../shared/utils/bossKeys'
import { bossKeys, users } from '../db/schema'
import type { Database } from '../db/client'
import type { User } from '../db/schema'

/**
 * La clé du joueur qui attend sa serrure : celle de son étage, pas encore
 * posée. Le joueur et l'étage se donnent en valeurs, ou en colonnes pour une
 * sous-requête corrélée.
 */
export function keyToPlace(userId: number | SQLWrapper, floor: number | SQLWrapper): SQL {
  return and(eq(bossKeys.userId, userId), eq(bossKeys.floor, floor), isNull(bossKeys.placedAt))!
}

function buildGrantKeyQuery(db: Database, player: User, now: Date) {
  return db
    .insert(bossKeys)
    .values({ userId: player.id, floor: player.currentFloor, obtainedAt: now })
    .onConflictDoNothing()
}

type GrantKeyQuery = ReturnType<typeof buildGrantKeyQuery>

/**
 * Donner au joueur la clé du boss de son étage courant. Sans effet s'il l'a
 * déjà : une clé au plus par joueur et par étage. Une requête, à attendre ou à
 * mettre en lot — le coffre la passe avec le Mimic qu'il arme.
 * Voir specs/boss.md#obtention-de-la-clé.
 */
export function grantKey(db: Database, player: User, now: Date): GrantKeyQuery {
  return buildGrantKeyQuery(db, player, now)
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
      keyToPlace(player.id, player.currentFloor),
      sql`(select count(*) from (${keyHoldersQuery(db, player.id)})) < ${KEYS_TO_UNLOCK}`,
    ))
}
