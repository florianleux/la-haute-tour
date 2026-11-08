import { dayKey, daysBetween } from '../../shared/utils/time'
import type { User } from '../db/schema'

/**
 * Le **jour joué** : un jour où le joueur a résolu une question ou une épreuve
 * de boss, daté au jour du jeu (voir shared/utils/time.ts). Lu par
 * l'Assiduité, par le compteur des joueurs actifs et par le tirage des cibles.
 * Voir specs/spec.md#glossaire (Jour joué).
 */

export interface PlayedDay {
  lastPlayedDay: string
  daysPlayed: number
  playStreak: number
}

/**
 * Ce que devient le compte des jours joués quand une question ou une épreuve se
 * résout. Rend null quand le joueur a déjà joué aujourd'hui : il n'y a alors
 * rien à écrire, et c'est ce qui rend l'estampille gratuite sur le chemin de la
 * question. Voir specs/succes.md#assiduité.
 */
export function playedToday(
  user: Pick<User, 'lastPlayedDay' | 'daysPlayed' | 'playStreak'>,
  now: Date,
): PlayedDay | null {
  const today = dayKey(now)

  if (user.lastPlayedDay === today) {
    return null
  }

  const consecutive = user.lastPlayedDay !== null && daysBetween(user.lastPlayedDay, today) === 1

  return {
    lastPlayedDay: today,
    daysPlayed: user.daysPlayed + 1,
    playStreak: consecutive ? user.playStreak + 1 : 1,
  }
}
