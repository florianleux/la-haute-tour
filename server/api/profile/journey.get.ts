import { useDatabase } from '~~/server/db/client'
import { journeyStats } from '~~/server/utils/journey'
import type { JourneyStats } from '~~/server/utils/journey'

export interface JourneyResponse {
  journey: JourneyStats
}

/**
 * Le parcours du joueur signé, et de lui seul : il n'y a pas d'identifiant dans
 * la route. Aucun classement n'existe, donc aucun parcours ne se lit d'ailleurs
 * que du sien. Voir specs/ecrans.md#profil.
 */
export default defineEventHandler(async (event): Promise<JourneyResponse> => {
  const user = await requireAuth(event)

  return { journey: await journeyStats(useDatabase(), user) }
})
