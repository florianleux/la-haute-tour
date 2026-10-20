import { sql } from 'drizzle-orm'
import { users } from '../db/schema'
import type { SQL } from 'drizzle-orm'
import type { User } from '../db/schema'

/**
 * Le nom sous lequel le jeu montre un joueur aux autres joueurs : son nom
 * d'aventurier, ou son pseudo Discord tant qu'il ne s'est pas nommé — un joueur
 * test, lui, garde alors le nom que l'admin lui a donné. L'administration lit
 * le pseudo Discord à part : c'est lui qui relie un joueur à son compte.
 * Voir specs/spec.md (glossaire, « Nom d'aventurier »).
 */
export function displayName(user: Pick<User, 'adventurerName' | 'username'>): string {
  return user.adventurerName ?? user.username
}

/** La même règle, côté requête : pour nommer le joueur d'une jointure. */
export const displayNameColumn: SQL<string> = sql<string>`coalesce(${users.adventurerName}, ${users.username})`
