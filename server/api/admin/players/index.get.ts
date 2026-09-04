import { useDatabase } from '~~/server/db/client'
import { playerRoster } from '~~/server/utils/players'
import type { PlayerCard } from '~~/server/utils/players'

export interface PlayersResponse {
  players: PlayerCard[]
}

/**
 * Les fiches joueurs de l'onglet Joueurs. Lecture sans effet : ouvrir l'onglet
 * ne fait avancer aucune partie. Voir specs/admin.md#gestion-des-joueurs.
 */
export default defineEventHandler(async (event): Promise<PlayersResponse> => {
  await requireAdmin(event)

  return { players: await playerRoster(useDatabase(), new Date()) }
})
