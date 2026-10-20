import { and, asc, eq } from 'drizzle-orm'
import { items } from '../db/schema'
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
}

/** Les Objets du joueur, dans l'ordre où il les a reçus. */
export async function readItems(db: Database, userId: number): Promise<ItemId[]> {
  const rows = await db
    .select({ item: items.item })
    .from(items)
    .where(eq(items.userId, userId))
    .orderBy(asc(items.obtainedAt), asc(items.id))

  return rows.map(row => row.item)
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
