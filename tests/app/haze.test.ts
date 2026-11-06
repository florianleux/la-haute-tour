import { describe, expect, it } from 'vitest'
import { HAZE_RAMP_MS, hazeAt } from '../../utils/haze'

describe('hazeAt', () => {
  it('part de l écran normal', () => {
    expect(hazeAt(0)).toMatchObject({ displacement: 0, hue: 0, saturation: 1 })
  })

  it('monte jusqu à sa pleine force, puis y reste', () => {
    const half = hazeAt(HAZE_RAMP_MS / 2)
    const full = hazeAt(HAZE_RAMP_MS)

    expect(half.displacement).toBe(full.displacement / 2)
    expect(hazeAt(HAZE_RAMP_MS * 10).displacement).toBe(full.displacement)
    expect(hazeAt(HAZE_RAMP_MS * 10).saturation).toBe(full.saturation)
  })

  it('fait avancer la houle sans jamais marquer d arrêt', () => {
    const weights = (elapsed: number): number[] => hazeAt(elapsed).swell.split(/\s+/).slice(0, 2).map(Number)
    const step = (elapsed: number): number => Math.hypot(...weights(elapsed + 100).map((weight, channel) => weight - weights(elapsed)[channel]!))

    for (const elapsed of [0, 700, 1500, 3000, 4500]) {
      expect(step(elapsed)).toBeCloseTo(step(0), 6)
    }
    expect(step(0)).toBeGreaterThan(0)
  })

  it('fait tourner les couleurs sans fin', () => {
    expect(hazeAt(HAZE_RAMP_MS * 10).hue).toBeLessThan(360)
    expect(hazeAt(HAZE_RAMP_MS).hue).toBeGreaterThan(0)
  })
})
