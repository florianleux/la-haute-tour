import { GAME_TIME_ZONE } from '../../shared/utils/time'
import type { User } from '../db/schema'

/**
 * Le jour du jeu et le **jour joué** : un jour où le joueur a résolu une
 * question ou une épreuve de boss, daté en Europe/Paris. Lu par l'assiduité,
 * par le compteur des joueurs actifs et par le tirage des cibles.
 * Voir specs/spec.md#glossaire (Jour joué).
 *
 * Les jours se comptent en dates et jamais en millisecondes : un changement
 * d'heure fait des journées de 23 et de 25 heures, et « hier » doit rester hier.
 * Deux dates seules se parsent en UTC, donc leur écart est exact.
 */

const DAY_MS = 86_400_000

/**
 * Le jour du jeu, au fuseau que les deux côtés partagent. `en-CA` rend la forme
 * `YYYY-MM-DD`, celle sous laquelle les jours se comparent — comme des chaînes.
 */
const dayKeyFormat = new Intl.DateTimeFormat('en-CA', { timeZone: GAME_TIME_ZONE })

export function dayKey(now: Date): string {
  return dayKeyFormat.format(now)
}

/** Le jour du jeu `count` jours avant `day`. */
export function daysBefore(day: string, count: number): string {
  return new Date(Date.parse(day) - count * DAY_MS).toISOString().slice(0, 10)
}

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

  const consecutive = user.lastPlayedDay === daysBefore(today, 1)

  return {
    lastPlayedDay: today,
    daysPlayed: user.daysPlayed + 1,
    playStreak: consecutive ? user.playStreak + 1 : 1,
  }
}
