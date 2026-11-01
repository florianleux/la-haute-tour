import { useDatabase } from '~~/server/db/client'
import { dayKey } from '~~/server/utils/achievements'
import { playerRoster } from '~~/server/utils/players'
import type { PlayerCard } from '~~/server/utils/players'

export interface PlayersResponse {
  players: PlayerCard[]
  /** Joueurs qui ont répondu aujourd'hui, et sur les 7 derniers jours du jeu. */
  active: { today: number, week: number }
}

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Les fiches joueurs de l'onglet Joueurs. Lecture sans effet : ouvrir l'onglet
 * ne fait avancer aucune partie. Voir specs/admin.md#gestion-des-joueurs.
 */
export default defineEventHandler(async (event): Promise<PlayersResponse> => {
  await requireAdmin(event)

  const now = new Date()
  const players = await playerRoster(useDatabase(), now)
  // `YYYY-MM-DD` se compare comme une chaîne.
  const today = dayKey(now)
  const weekStart = dayKey(new Date(now.getTime() - 6 * DAY_MS))
  const days = players.map(player => player.lastPlayedDay).filter(day => day !== null)

  return {
    players,
    active: {
      today: days.filter(day => day === today).length,
      week: days.filter(day => day >= weekStart).length,
    },
  }
})
