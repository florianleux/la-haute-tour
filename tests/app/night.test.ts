import { describe, expect, it } from 'vitest'
import { isNight } from '../../shared/utils/time'
import { campImage } from '../../utils/night'

describe('isNight', () => {
  it.each([
    ['2026-11-04T18:59:59Z', false], // 19h59, heure d'hiver
    ['2026-11-04T19:00:00Z', true], // 20h00
    ['2026-11-04T22:59:00Z', true], // 23h59
    ['2026-11-04T23:00:00Z', true], // minuit
    ['2026-11-05T05:59:59Z', true], // 6h59
    ['2026-11-05T06:00:00Z', false], // 7h00
    ['2026-07-01T17:59:00Z', false], // 19h59, heure d'été
    ['2026-07-01T18:00:00Z', true], // 20h00
  ])('%s : %s', (iso, night) => {
    expect(isNight(new Date(iso))).toBe(night)
  })
})

describe('campImage', () => {
  it('choisit la version du moment', () => {
    expect(campImage('cooldown-book', false)).toBe('/images/cooldown-book.webp')
    expect(campImage('cooldown-book', true)).toBe('/images/cooldown-book-night.webp')
  })
})
