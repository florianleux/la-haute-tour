import { describe, expect, it } from 'vitest'
import { formatDay, formatRemaining } from '../../utils/date'

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
