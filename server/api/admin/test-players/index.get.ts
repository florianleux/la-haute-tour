import { useDatabase } from '~~/server/db/client'
import { testPlayerRoster } from '~~/server/utils/players'
import type { PlayerCard } from '~~/server/utils/players'

export interface TestPlayersResponse {
  testPlayers: PlayerCard[]
}

/**
 * Les fiches des joueurs test. Même lecture sans effet que l'onglet Joueurs :
 * l'ouvrir ne fait avancer aucune partie. Voir specs/admin.md#joueurs-test.
 */
export default defineEventHandler(async (event): Promise<TestPlayersResponse> => {
  await requireAdmin(event)

  return { testPlayers: await testPlayerRoster(useDatabase(), new Date()) }
})
