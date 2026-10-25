import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { BOSS_DOORS } from '../../utils/bossDoors'

const publicDir = fileURLToPath(new URL('../../public', import.meta.url))

/** Les décors plein écran (CLAUDE.md#images) : le camp, sa version floue, le ciel du jeu, les portes de boss. */
const BACKDROPS = [
  '/images/cooldown-bg.webp',
  '/images/blurry-cooldown-bg.webp',
  '/images/play-bg.webp',
  ...Object.values(BOSS_DOORS).map(door => door!.image),
]

/**
 * La taille d'un webp, lue dans son en-tête. Étendu (VP8X, quand l'image garde
 * un profil couleur) : 24 bits de largeur puis 24 de hauteur, moins un. Sans
 * perte (VP8L) : 14 et 14, moins un, après la signature du bloc. Avec perte
 * (VP8) : 14 et 14 après le code de début de trame.
 */
function webpSize(file: string): { width: number, height: number } {
  const bytes = readFileSync(file)
  const chunk = bytes.toString('ascii', 12, 16)
  if (chunk === 'VP8X') {
    return { width: bytes.readUIntLE(24, 3) + 1, height: bytes.readUIntLE(27, 3) + 1 }
  }
  if (chunk === 'VP8L') {
    const bits = bytes.readUInt32LE(21)
    return { width: (bits & 0x3FFF) + 1, height: ((bits >> 14) & 0x3FFF) + 1 }
  }
  expect(chunk).toBe('VP8 ')
  return { width: bytes.readUInt16LE(26) & 0x3FFF, height: bytes.readUInt16LE(28) & 0x3FFF }
}

describe('les décors plein écran', () => {
  it.each(BACKDROPS)('%s est en 20:9', (image) => {
    const { width, height } = webpSize(join(publicDir, image))
    expect(width / height).toBeCloseTo(20 / 9, 2)
  })
})
