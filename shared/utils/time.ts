/**
 * Le fuseau du jeu, en un seul endroit. Partagé parce que les deux côtés
 * découpent les jours : le serveur date le jour joué d'un succès d'assiduité,
 * l'écran date ce qu'il montre au joueur.
 *
 * Deux copies tomberaient tôt ou tard sur deux jours différents — et c'est
 * exactement ce que le rendu serveur puis l'hydratation du navigateur feraient
 * apparaître. Voir utils/date.ts et server/utils/playedDays.ts.
 */
export const GAME_TIME_ZONE = 'Europe/Paris'

/**
 * Le jour du jeu, en `YYYY-MM-DD` — la forme sous laquelle les jours se
 * comparent, comme des chaînes. `en-CA` la rend telle quelle.
 */
const dayKeyFormat = new Intl.DateTimeFormat('en-CA', { timeZone: GAME_TIME_ZONE })

export function dayKey(at: Date | number): string {
  return dayKeyFormat.format(at)
}

/**
 * Combien de jours du jeu séparent `from` de `to`, deux `dayKey` : 1 de la
 * veille à aujourd'hui. Compté en dates et jamais en millisecondes d'horloge :
 * un changement d'heure fait des journées de 23 et de 25 heures, et « hier »
 * doit rester hier. Deux dates seules se parsent en UTC, donc leur écart est
 * exact.
 */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000)
}

const hourFormat = new Intl.DateTimeFormat('en-GB', { timeZone: GAME_TIME_ZONE, hour: 'numeric', hourCycle: 'h23' })

/** L'heure du jeu, de 0 à 23. */
export function gameHour(now: Date): number {
  return Number(hourFormat.format(now))
}

/**
 * De 20h à 7h, heure du jeu : le même créneau pour tous, au rendu serveur comme
 * dans le navigateur. Voir specs/spec.md#glossaire (Nuit).
 */
export function isNight(now: Date): boolean {
  const hour = gameHour(now)
  return hour >= 20 || hour < 7
}
