import { useDatabase } from '~~/server/db/client'
import { readPocketSpells } from '~~/server/utils/pocketSpells'
import type { PocketSpellsView } from '~~/server/utils/pocketSpells'

/**
 * Les sorts que le joueur possède. Refusé hors du camp : c'est le seul moment où
 * les Sorts existent, et la page qui les montre n'est donc pas atteignable
 * ailleurs. Voir specs/ecrans.md#sorts.
 */
export default defineEventHandler(async (event): Promise<PocketSpellsView> => {
  const user = await requireAuth(event)

  return readPocketSpells(useDatabase(), user, new Date())
})
