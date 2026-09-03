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
 * How long is left, as a player reads a wait: "11 h 58 min", "4 min", "moins d'une
 * minute". Past the deadline it is over, not negative.
 */
export function formatRemaining(iso: string, now: number): string {
  const minutes = Math.ceil((new Date(iso).getTime() - now) / 60_000)

  // Une échéance absente ou illisible n'est pas une attente : mieux vaut le dire
  // que rendre « NaN h NaN min ».
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return 'terminée'
  }

  if (minutes < 60) {
    return `${minutes} min`
  }

  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60

  return rest ? `${hours} h ${rest} min` : `${hours} h`
}
