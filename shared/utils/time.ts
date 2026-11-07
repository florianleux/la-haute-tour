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
