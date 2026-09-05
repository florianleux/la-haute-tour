import { z } from 'zod'
import { useDatabase } from '~~/server/db/client'
import { castFromInventory } from '~~/server/utils/inventory'
import { CASTABLE_SPELL_IDS } from '~~/shared/utils/spells'
import type { InventoryView } from '~~/server/utils/inventory'

// Seuls les sorts dont l'effet existe se lancent : un sort du catalogue encore
// à implémenter est refusé plutôt que consommé pour rien.
const bodySchema = z.object({ spell: z.enum(CASTABLE_SPELL_IDS) })

/**
 * Lancer un sort de son inventaire. Sur soi seulement à ce stade : la catégorie
 * de cible arrive avec les équipes. Refusé hors attente, la seule phase où le
 * lancer existe. Voir specs/bonus.md#où-et-quand.
 */
export default defineEventHandler(async (event): Promise<InventoryView> => {
  const user = await requireAuth(event)
  const { spell } = await readValidatedBody(event, bodySchema.parse)

  return castFromInventory(useDatabase(), user, spell, new Date())
})
