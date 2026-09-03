import { describe, expect, it } from 'vitest'
import { formatDay } from '../../utils/date'

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
