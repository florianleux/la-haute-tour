import { describe, expect, it } from 'vitest'
import { formatCountdown, formatDay, formatDuration, formatReturnAt, formatRemaining, formatTime, formatWait } from '../../utils/date'

describe('date lisible', () => {
  it('rend le jour en français', () => {
    expect(formatDay('2026-09-01T10:00:00.000Z')).toBe('1 septembre 2026')
  })

  it('lit l heure à Paris, pas à celle de la machine', () => {
    // 23h30 UTC le 1er, c est déjà le 2 à Paris. Sans fuseau explicite, le serveur
    // et le navigateur pourraient afficher deux jours différents.
    expect(formatDay('2026-09-01T23:30:00.000Z')).toBe('2 septembre 2026')
  })
})

describe('temps restant', () => {
  const now = new Date('2026-09-03T12:00:00.000Z').getTime()

  function inMinutes(minutes: number): string {
    return new Date(now + minutes * 60_000).toISOString()
  }

  function inSeconds(seconds: number): string {
    return new Date(now + seconds * 1000).toISOString()
  }

  it('compte en heures, minutes et secondes sur une longue attente', () => {
    expect(formatRemaining(inSeconds(12 * 3600), now)).toBe('12 h 0 min 0 s')
    expect(formatRemaining(inSeconds(11 * 3600 + 58 * 60 + 12), now)).toBe('11 h 58 min 12 s')
  })

  it('compte en minutes et secondes sur la dernière heure', () => {
    expect(formatRemaining(inSeconds(4 * 60 + 32), now)).toBe('4 min 32 s')
  })

  it('compte en secondes sous la minute', () => {
    expect(formatRemaining(inSeconds(32), now)).toBe('32 s')
  })

  it('ne compte jamais à l envers une fois l échéance passée', () => {
    expect(formatRemaining(inMinutes(-30), now)).toBe('terminée')
  })

  it('ne rend pas « NaN h » sur une échéance absente', () => {
    expect(formatRemaining('', now)).toBe('terminée')
  })
})

describe('décompte en cadran', () => {
  const now = new Date('2026-09-03T12:00:00.000Z').getTime()

  function inSeconds(seconds: number): string {
    return new Date(now + seconds * 1000).toISOString()
  }

  it('complète heures et minutes au-delà de l heure', () => {
    expect(formatCountdown(inSeconds(90 * 60), now)).toBe('01:30:00')
    expect(formatCountdown(inSeconds(11 * 3600 + 58 * 60 + 12), now)).toBe('11:58:12')
  })

  it('ne complète pas l unité de tête, qui porte la grandeur du délai', () => {
    expect(formatCountdown(inSeconds(12 * 60 + 4), now)).toBe('12:04')
    expect(formatCountdown(inSeconds(4 * 60 + 32), now)).toBe('4:32')
    expect(formatCountdown(inSeconds(32), now)).toBe('32')
    expect(formatCountdown(inSeconds(8), now)).toBe('8')
  })

  it('complète toujours celles qui suivent, sinon « 4:7 » se lirait sept minutes', () => {
    expect(formatCountdown(inSeconds(4 * 60 + 7), now)).toBe('4:07')
    expect(formatCountdown(inSeconds(3600 + 5 * 60 + 9), now)).toBe('01:05:09')
  })

  it('ne compte pas à l envers une fois l échéance passée', () => {
    expect(formatCountdown(inSeconds(-1800), now)).toBe('terminée')
    expect(formatCountdown('', now)).toBe('terminée')
  })
})

describe('attente à la minute', () => {
  const now = new Date('2026-09-03T12:00:00.000Z').getTime()

  function inSeconds(seconds: number): string {
    return new Date(now + seconds * 1000).toISOString()
  }

  it('compte en heures et minutes sur une longue attente', () => {
    expect(formatWait(inSeconds(11 * 3600 + 58 * 60 + 12), now)).toBe('11 h 59 min')
  })

  it('compte en minutes sous l heure', () => {
    expect(formatWait(inSeconds(4 * 60), now)).toBe('4 min')
  })

  it('arrondit au-dessus : ce qui reste reste', () => {
    expect(formatWait(inSeconds(30), now)).toBe('1 min')
  })

  it('ne compte jamais à l envers une fois l échéance passée', () => {
    expect(formatWait(inSeconds(-30), now)).toBe('terminée')
    expect(formatWait('', now)).toBe('terminée')
  })
})

describe('durée de règle', () => {
  it('tait les unités nulles', () => {
    expect(formatDuration(12 * 3_600_000)).toBe('12 h')
    expect(formatDuration(120_000)).toBe('2 min')
    expect(formatDuration(90_000)).toBe('1 min 30 s')
    expect(formatDuration(30_000)).toBe('30 s')
    expect(formatDuration(3_600_000 + 15_000)).toBe('1 h 15 s')
  })

  it('arrondit à la seconde', () => {
    expect(formatDuration(15_499)).toBe('15 s')
  })
})

describe('heure', () => {
  it('lit l heure à Paris', () => {
    expect(formatTime('2026-09-01T16:42:00.000Z')).toBe('18:42')
  })
})

describe('heure de retour', () => {
  // 10h00 à Paris.
  const now = new Date('2026-09-03T08:00:00.000Z').getTime()

  it('donne l heure seule le jour même', () => {
    expect(formatReturnAt('2026-09-03T11:34:00.000Z', now)).toBe('à 13h34')
  })

  it('dit demain quand l attente passe minuit à Paris', () => {
    expect(formatReturnAt('2026-09-04T01:56:00.000Z', now)).toBe('demain à 3h56')
  })

  it('donne la date au-delà de demain', () => {
    expect(formatReturnAt('2026-09-05T08:00:00.000Z', now)).toBe('le 5 septembre à 10h00')
  })
})
