import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { BOSS_DOORS } from '../../utils/bossDoors'
import { BOSSES } from '../../utils/bosses'
import { BOSS_INTROS, introFor } from '../../utils/bossIntros'

const publicDir = fileURLToPath(new URL('../../public', import.meta.url))

const intros = Object.entries(BOSS_INTROS)

describe('les introductions de boss', () => {
  it('suivent une porte du même étage', () => {
    for (const [floor] of intros) {
      expect(BOSS_DOORS[Number(floor)]).toBeDefined()
    }
  })

  it('présentent un boss du catalogue, même étage', () => {
    for (const [floor] of intros) {
      expect(BOSSES[Number(floor)]).toBeDefined()
    }
  })

  it('ont une nuée dans le dossier de leur boss', () => {
    for (const [floor, intro] of intros) {
      for (const image of intro!.swarm?.images ?? []) {
        expect(image).toMatch(new RegExp(`^/images/boss/${floor}/`))
        expect(existsSync(join(publicDir, image))).toBe(true)
      }
    }
  })

  it('montrent le boss avant de le faire parler', () => {
    for (const [, intro] of intros) {
      const firstWord = intro!.beats.findIndex(({ speaker }) => speaker === 'boss')
      const appearance = intro!.beats.findIndex(({ cue }) => cue === 'appear')
      expect(appearance).toBeGreaterThanOrEqual(0)
      expect(appearance).toBeLessThanOrEqual(firstWord)
    }
  })
})

// specs/boss.md#introduction-et-animations
describe('l introduction jouée à « Entrer »', () => {
  const intro = BOSS_INTROS[1]!

  it('est l introduction entière au premier combat', () => {
    expect(introFor(intro, 0)).toBe(intro)
  })

  it('n est plus, aux combats relancés, qu une réplique du boss, sans nuée ni titre, propre à chaque combat', () => {
    const lines = [1, 2, 3, 4, 5].map((fought) => {
      const retry = introFor(intro, fought)!
      expect(retry.swarm).toBeUndefined()
      expect(retry.beats.map(({ cue }) => cue)).not.toContain('title')
      expect(retry.beats.filter(({ speaker }) => speaker === 'boss')).toHaveLength(1)
      return retry.beats.at(-1)!.text
    })

    expect(new Set(lines).size).toBe(5)
  })

  it('n existe pas sans réplique pour ce combat', () => {
    expect(introFor(intro, 6)).toBeUndefined()
    expect(introFor(undefined, 0)).toBeUndefined()
  })
})
