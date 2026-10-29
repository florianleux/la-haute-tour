import { useDatabase } from '~~/server/db/client'
import { requireCamp } from '~~/server/utils/camp'
import { readItems } from '~~/server/utils/items'
import type { ItemsView } from '~~/server/utils/items'

/**
 * Ce que le sac du joueur contient : ses Objets, jamais ses sorts, qui vivent
 * au Grimoire. Refusé hors du camp, comme les sorts en poche : l'Inventaire ne
 * s'ouvre que là. Voir specs/ecrans.md#inventaire.
 */
export default defineEventHandler(async (event): Promise<ItemsView> => {
  const user = await requireAuth(event)
  const db = useDatabase()

  await requireCamp(db, user, new Date())

  return readItems(db, user)
})
