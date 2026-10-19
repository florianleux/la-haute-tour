import { z } from 'zod'
import { useDatabase } from '~~/server/db/client'
import { castFromPocket } from '~~/server/utils/pocketSpells'
import { CASTABLE_SPELL_IDS } from '~~/shared/utils/spells'
import { TARGET_KINDS } from '~~/shared/utils/teams'
import type { PocketSpellsView } from '~~/server/utils/pocketSpells'

// Seuls les sorts dont l'effet existe se lancent : un sort du catalogue encore
// à implémenter serait consommé pour rien. Les trois catégories de cible, elles,
// agissent toutes.
const bodySchema = z.object({
  spell: z.enum(CASTABLE_SPELL_IDS),
  target: z.enum(TARGET_KINDS),
})

/**
 * Lancer un de ses sorts en poche vers une catégorie de cible — soi, ou un
 * allié ou un ennemi que le serveur tire. Jamais une personne : le client ne
 * nomme personne, il ne pourrait pas. Refusé hors du camp, le seul moment où le
 * lancer existe.
 * Voir specs/bonus.md#où-et-quand et specs/bonus.md#tirage-de-la-cible.
 */
export default defineEventHandler(async (event): Promise<PocketSpellsView> => {
  const user = await requireAuth(event)
  const { spell, target } = await readValidatedBody(event, bodySchema.parse)

  return castFromPocket(useDatabase(), user, spell, target, new Date())
})
