import { useDatabase } from '~~/server/db/client'
import { requireCamp } from '~~/server/utils/camp'
import { readItems } from '~~/server/utils/items'
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

  return { items: await readItems(db, user.id) }
})
