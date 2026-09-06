import { z } from 'zod'
import { useDatabase } from '~~/server/db/client'
import { castFromInventory } from '~~/server/utils/inventory'
import { CASTABLE_SPELL_IDS } from '~~/shared/utils/spells'
import { CASTABLE_TARGET_KINDS } from '~~/shared/utils/teams'
import type { InventoryView } from '~~/server/utils/inventory'

// Seuls les sorts dont l'effet existe se lancent, et seules les catégories de
// cible qu'un tirage sait résoudre : le reste est refusé plutôt que consommé
// pour rien.
const bodySchema = z.object({
  spell: z.enum(CASTABLE_SPELL_IDS),
  target: z.enum(CASTABLE_TARGET_KINDS),
})

/**
 * Lancer un sort de son inventaire vers une catégorie de cible — soi, ou un
 * allié que le serveur tire. Jamais une personne : le client ne nomme personne,
 * il ne pourrait pas. Refusé hors attente, la seule phase où le lancer existe.
 * Voir specs/bonus.md#où-et-quand et specs/bonus.md#tirage-de-la-cible.
 */
export default defineEventHandler(async (event): Promise<InventoryView> => {
  const user = await requireAuth(event)
  const { spell, target } = await readValidatedBody(event, bodySchema.parse)

  return castFromInventory(useDatabase(), user, spell, target, new Date())
})
