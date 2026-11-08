import { useDatabase } from '~~/server/db/client'
import { playerRoster } from '~~/server/utils/players'
import { dayKey, daysBetween } from '~~/shared/utils/time'
import type { PlayerCard } from '~~/server/utils/players'

export interface PlayersResponse {
  players: PlayerCard[]
  /** Joueurs qui ont un jour joué aujourd'hui, et sur les 7 derniers jours du jeu. */
  active: { today: number, week: number }
}

/**
 * Les fiches joueurs de l'onglet Joueurs. Lecture sans effet : ouvrir l'onglet
 * ne fait avancer aucune partie. Voir specs/admin.md#gestion-des-joueurs.
 */
export default defineEventHandler(async (event): Promise<PlayersResponse> => {
  await requireAdmin(event)

  const now = new Date()
  const players = await playerRoster(useDatabase(), now)
  const today = dayKey(now)
  // Combien de jours du jeu avant aujourd'hui : 0 aujourd'hui, 6 au bout de la semaine.
  const ages = players.map(player => player.lastPlayedDay).filter(day => day !== null).map(day => daysBetween(day, today))

  return {
    players,
    active: {
      today: ages.filter(age => age === 0).length,
      week: ages.filter(age => age <= 6).length,
    },
  }
})
