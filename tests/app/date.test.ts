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

  it('compte en heures et minutes sur une longue attente', () => {
    expect(formatRemaining(inMinutes(12 * 60), now)).toBe('12 h')
    expect(formatRemaining(inMinutes(11 * 60 + 58), now)).toBe('11 h 58 min')
  })

  it('compte en minutes sur la dernière heure', () => {
    expect(formatRemaining(inMinutes(4), now)).toBe('4 min')
  })

  it('ne compte jamais à l envers une fois l échéance passée', () => {
    expect(formatRemaining(inMinutes(-30), now)).toBe('terminée')
  })

  it('ne rend pas « NaN h » sur une échéance absente', () => {
    expect(formatRemaining('', now)).toBe('terminée')
  })
})
