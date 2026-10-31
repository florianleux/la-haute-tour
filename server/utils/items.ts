import { and, asc, eq } from 'drizzle-orm'
import { keyToPlace } from './bossKeys'
import { bossKeys, items } from '../db/schema'
import type { Database } from '../db/client'
import type { User } from '../db/schema'
import type { AchievementId } from '../../shared/utils/achievements'
import type { ItemId } from '../../shared/utils/items'

/**
 * Ce que fait chaque Objet quand le joueur l'utilise : quand il le peut. Une
 * entrée par Objet, et une seule route pour tous (server/api/game/items/use.post.ts) :
 * un Objet de plus ajoute son entrée, pas une route.
 *
 * Le Fromage n'a pas d'autre effet que de quitter le sac : il se donne à
 * Michel, à la leçon du camp, et à elle seule. Le donner vaut « HÉ ! ».
 * Voir specs/succes.md#michel--1.
 * Voir specs/spec.md (glossaire, « Utiliser », « Fromage »).
 */
export const ITEM_USES: Record<ItemId, {
  usableBy: (user: User) => boolean
  /** Les succès que l'utiliser débloque. */
  earns: AchievementId[]
}> = {
  CHEESE: { usableBy: user => user.campLessonAt === null, earns: ['CHEESE_GIVEN'] },
  // Une relique ne s'utilise pas, pour l'instant. Voir specs/boss.md#récompense.
  JULIEN_CARD: { usableBy: () => false, earns: [] },
}

export interface ItemsView {
  /** Les Objets du joueur, dans l'ordre où il les a reçus. */
  items: ItemId[]
  /**
   * L'étage de la clé du boss qui attend sa serrure, null sans clé à poser.
   * Au sac, pas au Grimoire : une clé n'est pas un sort.
   * Voir specs/boss.md#obtention-de-la-clé.
   */
  key: number | null
}

/** Le sac du joueur : ses Objets, dans l'ordre où il les a reçus, et sa clé pas encore posée. */
export async function readItems(db: Database, user: User): Promise<ItemsView> {
  const [rows, [key]] = await db.batch([
    db
      .select({ item: items.item })
      .from(items)
      .where(eq(items.userId, user.id))
      .orderBy(asc(items.obtainedAt), asc(items.id)),
    db
      .select({ floor: bossKeys.floor })
      .from(bossKeys)
      .where(keyToPlace(user.id, user.currentFloor)),
  ])

  return { items: rows.map(row => row.item), key: key?.floor ?? null }
}

/**
 * Retire du sac un exemplaire de l'Objet, le plus ancien. Faux si le sac n'en
 * contient aucun. Une seule requête : deux utilisations simultanées ne
 * retirent pas deux fois le même exemplaire.
 */
export async function takeItem(db: Database, userId: number, item: ItemId): Promise<boolean> {
  const oldest = db
    .select({ id: items.id })
    .from(items)
    .where(and(eq(items.userId, userId), eq(items.item, item)))
    .orderBy(asc(items.obtainedAt), asc(items.id))
    .limit(1)

  const taken = await db.delete(items).where(eq(items.id, oldest)).returning({ id: items.id })

  return taken.length > 0
}
