import { useDatabase } from '~~/server/db/client'
import { focusLossTally } from '~~/server/utils/focus'
import type { FocusLossTally } from '~~/server/utils/focus'

export interface FocusLossesResponse {
  players: FocusLossTally[]
}

/**
 * Les pertes de focus par joueur. Admin seulement : aucun écran joueur ne les
 * montre, pas même son profil. Voir specs/anti-triche.md#flags-côté-admin.
 */
export default defineEventHandler(async (event): Promise<FocusLossesResponse> => {
  await requireAdmin(event)

  return { players: await focusLossTally(useDatabase()) }
})
