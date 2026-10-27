import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { BOSS_DOORS } from '../../utils/bossDoors'
import { BOSSES } from '../../utils/bosses'
import { BOSS_INTROS } from '../../utils/bossIntros'

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
