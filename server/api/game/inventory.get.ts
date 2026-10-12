import { useDatabase } from '~~/server/db/client'
import { readInventory } from '~~/server/utils/inventory'
import type { InventoryView } from '~~/server/utils/inventory'

/**
 * Les sorts que le joueur possède. Refusé hors du camp : c'est le seul moment où
 * les Sorts existent, et la page qui les montre n'est donc pas atteignable
 * ailleurs. Voir specs/ecrans.md#sorts.
 */
export default defineEventHandler(async (event): Promise<InventoryView> => {
  const user = await requireAuth(event)

  return readInventory(useDatabase(), user, new Date())
})
