import { asc, eq } from 'drizzle-orm'
import { useDatabase } from '~~/server/db/client'
import { items } from '~~/server/db/schema'
import { requireCamp } from '~~/server/utils/camp'
import type { ItemId } from '~~/shared/utils/items'

export interface ItemsView {
  /** Les Objets du joueur, dans l'ordre où il les a reçus. */
  items: ItemId[]
}

/**
 * Ce que le sac du joueur contient : ses Objets, jamais ses sorts, qui vivent
 * au Grimoire. Refusé hors du camp, comme les sorts en poche : l'Inventaire ne
 * s'ouvre que là. Voir specs/ecrans.md#inventaire.
 */
export default defineEventHandler(async (event): Promise<ItemsView> => {
  const user = await requireAuth(event)
  const db = useDatabase()

  await requireCamp(db, user, new Date())

  const rows = await db
    .select({ item: items.item })
    .from(items)
    .where(eq(items.userId, user.id))
    .orderBy(asc(items.obtainedAt), asc(items.id))

  return { items: rows.map(row => row.item) }
})
