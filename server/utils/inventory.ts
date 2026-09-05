import { count, eq, min } from 'drizzle-orm'
import { readGameState } from './game'
import { inventory } from '../db/schema'
import type { Database } from '../db/client'
import type { User } from '../db/schema'
import type { SpellId } from '../../shared/utils/spells'

export interface InventoryEntryView {
  spell: SpellId
  /** Le nombre d'exemplaires possédés : les doublons sont illimités. */
  count: number
}

export interface InventoryView {
  entries: InventoryEntryView[]
  /** Le nombre d'exemplaires, toutes lignes confondues. */
  total: number
}

/**
 * L'inventaire du joueur, un empilement par sort. Groupé plutôt que rendu ligne
 * à ligne : un exemplaire ne se distingue d'un autre par rien, et c'est le
 * nombre qui se lit. Trié par premier exemplaire obtenu, pour qu'un coffre qui
 * ajoute un doublon ne déplace pas la liste sous les yeux du joueur.
 *
 * Refusé hors attente : le lancer n'existe que là, donc la page qui montre
 * l'inventaire n'est pas atteignable ailleurs — URL comprise, d'où le refus ici
 * et pas seulement dans la navigation.
 * Voir specs/bonus.md#sorts et specs/ecrans.md#sorts.
 */
export async function readInventory(db: Database, user: User, now: Date): Promise<InventoryView> {
  const { phase } = await readGameState(db, user, now)

  if (phase !== 'cooldown') {
    throw createError({ statusCode: 403, statusMessage: 'Les Sorts ne se lancent qu\'en attente' })
  }

  const stacks = await db
    .select({
      spell: inventory.spell,
      owned: count(),
    })
    .from(inventory)
    .where(eq(inventory.userId, user.id))
    .groupBy(inventory.spell)
    .orderBy(min(inventory.obtainedAt))

  return {
    entries: stacks.map(({ spell, owned }) => ({ spell, count: owned })),
    total: stacks.reduce((sum, stack) => sum + stack.owned, 0),
  }
}
