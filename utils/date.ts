/**
 * A date as the player reads it. Explicit time zone: without it the string
 * rendered by the server and the one rendered by the browser can fall on two
 * different days, and hydration diverges.
 */
const dayFormat = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'long',
  timeZone: 'Europe/Paris',
})

export function formatDay(iso: string): string {
  return dayFormat.format(new Date(iso))
}

/**
 * How long is left, as a player reads a wait — détaillé à la seconde, parce que
 * l'attente se compte à la seconde près. "11 h 58 min 12 s", "4 min 32 s", "32 s".
 * Past the deadline it is over, not negative.
 */
export function formatRemaining(iso: string, now: number): string {
  const seconds = Math.ceil((new Date(iso).getTime() - now) / 1000)

  // Une échéance absente ou illisible n'est pas une attente : mieux vaut le dire
  // que rendre « NaN h NaN min ».
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return 'terminée'
  }

  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  if (hours > 0) {
    return `${hours} h ${minutes} min ${secs} s`
  }

  if (minutes > 0) {
    return `${minutes} min ${secs} s`
  }

  return `${secs} s`
}

/**
 * La même attente, à la minute près : ce que l'administration lit d'un joueur
 * qu'elle n'est pas en train de faire patienter. « 11 h 58 min », « 4 min ».
 * Arrondie au-dessus : trente secondes restantes se lisent « 1 min », parce
 * qu'une attente qui reste est une attente.
 */
export function formatWait(iso: string, now: number): string {
  const minutes = Math.ceil((new Date(iso).getTime() - now) / 60_000)

  if (!Number.isFinite(minutes) || minutes <= 0) {
    return 'terminée'
  }

  const hours = Math.floor(minutes / 60)

  return hours > 0 ? `${hours} h ${minutes % 60} min` : `${minutes} min`
}
