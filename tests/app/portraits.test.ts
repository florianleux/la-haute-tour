import { describe, expect, it } from 'vitest'
import { playerPortrait } from '../../utils/portraits'

describe('portrait du joueur', () => {
  it('suit le genre donné à L Inconnu', () => {
    expect(playerPortrait('FEMALE')).toBe('/images/intro-player-female.webp')
    expect(playerPortrait('NEUTRAL')).toBe('/images/intro-player-neutral.webp')
  })

  it('montre l aventurier, jamais la silhouette, à qui n a pas répondu', () => {
    expect(playerPortrait(null)).toBe('/images/intro-player-male.webp')
  })
})
