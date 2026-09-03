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
