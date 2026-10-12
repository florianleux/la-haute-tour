import { GAME_TIME_ZONE } from '~~/shared/utils/time'

/**
 * A date as the player reads it. Explicit time zone: without it the string
 * rendered by the server and the one rendered by the browser can fall on two
 * different days, and hydration diverges.
 */
const dayFormat = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'long',
  timeZone: GAME_TIME_ZONE,
})

export function formatDay(iso: string): string {
  return dayFormat.format(new Date(iso))
}

/** Le jour et l'heure, même fuseau explicite et pour la même raison. */
const dayTimeFormat = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'long',
  timeStyle: 'short',
  timeZone: GAME_TIME_ZONE,
})

export function formatDayTime(iso: string): string {
  return dayTimeFormat.format(new Date(iso))
}

/** Des secondes en heures, minutes et secondes : la découpe que les durées partagent. */
function splitSeconds(totalSeconds: number): { hours: number, minutes: number, secs: number } {
  return {
    hours: Math.floor(totalSeconds / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    secs: totalSeconds % 60,
  }
}

/**
 * How long is left, as a player reads a cooldown — détaillé à la seconde, parce que
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

  const { hours, minutes, secs } = splitSeconds(seconds)

  if (hours > 0) {
    return `${hours} h ${minutes} min ${secs} s`
  }

  if (minutes > 0) {
    return `${minutes} min ${secs} s`
  }

  return `${secs} s`
}

/**
 * La même attente, en cadran : « 01:30:00 », « 12:04 », « 4:32 », « 32 », « 8 ».
 * Ce que porte le drapeau du poster d'attente, où le décompte est lu d'un coup
 * d'œil et non dans une phrase — la forme en toutes lettres de `formatRemaining`
 * y tiendrait mal et se lirait moins vite.
 *
 * Seule l'unité de tête n'est pas complétée à deux chiffres : elle porte la
 * grandeur du délai, et « 4:32 » se lit plus vite que « 04:32 ». Celles qui
 * suivent le sont toujours, sans quoi « 4:7 » se lirait quatre minutes sept.
 *
 * Même contrat que `formatRemaining` sur les bords : une échéance passée,
 * absente ou illisible n'est pas un décompte, et se dit plutôt que de rendre
 * « NaN:NaN ».
 */
export function formatCountdown(iso: string, now: number): string {
  const seconds = Math.ceil((new Date(iso).getTime() - now) / 1000)

  if (!Number.isFinite(seconds) || seconds <= 0) {
    return 'terminée'
  }

  const { hours, minutes, secs } = splitSeconds(seconds)
  const pad = (value: number): string => String(value).padStart(2, '0')

  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(secs)}`
  }

  if (minutes > 0) {
    return `${minutes}:${pad(secs)}`
  }

  return String(secs)
}

/**
 * La même attente, à la minute près : ce que l'administration lit d'un joueur
 * qu'elle n'est pas en train de faire patienter. « 11 h 58 min », « 4 min ».
 * Arrondie au-dessus : trente secondes restantes se lisent « 1 min », parce
 * qu'une attente qui reste est une attente.
 */
export function formatCooldownMinutes(iso: string, now: number): string {
  const minutes = Math.ceil((new Date(iso).getTime() - now) / 60_000)

  if (!Number.isFinite(minutes) || minutes <= 0) {
    return 'terminée'
  }

  const hours = Math.floor(minutes / 60)

  return hours > 0 ? `${hours} h ${minutes % 60} min` : `${minutes} min`
}

/** L'heure seule, même fuseau explicite : « 18:42 ». */
const timeFormat = new Intl.DateTimeFormat('fr-FR', {
  timeStyle: 'short',
  timeZone: GAME_TIME_ZONE,
})

export function formatTime(iso: string): string {
  return timeFormat.format(new Date(iso))
}

/** Le jour calendaire à Paris, « 2026-09-01 » : de quoi comparer deux dates au jour près. */
const calendarDayFormat = new Intl.DateTimeFormat('en-CA', { timeZone: GAME_TIME_ZONE })

/**
 * Quand revenir, comme on le dit à voix haute : « à 13h34 », « demain à 3h56 »,
 * « le 12 octobre à 3h56 ». Le jour se compare à Paris, pas sur la machine.
 */
export function formatReturnAt(iso: string, now: number): string {
  const time = formatTime(iso).replace(/^0?(\d+):/, '$1h')
  const day = calendarDayFormat.format(new Date(iso))

  if (day === calendarDayFormat.format(now)) {
    return `à ${time}`
  }

  if (day === calendarDayFormat.format(now + 86_400_000)) {
    return `demain à ${time}`
  }

  return `le ${formatDay(iso).replace(/ \d{4}$/, '')} à ${time}`
}

/**
 * Une durée de règle, pas un décompte : « 12 h », « 2 min », « 1 min 30 s ».
 * Les unités nulles se taisent — une attente de douze heures ne se lit pas
 * « 12 h 0 min 0 s ». Arrondie à la seconde : un timer divisé tombe parfois
 * entre deux.
 */
export function formatDuration(ms: number): string {
  const { hours, minutes, secs } = splitSeconds(Math.round(ms / 1000))
  const parts = [[hours, 'h'], [minutes, 'min'], [secs, 's']] as const

  return parts
    .filter(([value]) => value > 0)
    .map(([value, unit]) => `${value} ${unit}`)
    .join(' ') || '0 s'
}
