import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { BOSS_DOORS } from '../../utils/bossDoors'
import { BOSSES } from '../../utils/bosses'

const publicDir = fileURLToPath(new URL('../../public', import.meta.url))

const bosses = Object.entries(BOSSES)

describe('les boss', () => {
  it('gardent une porte du même étage', () => {
    for (const [floor] of bosses) {
      expect(BOSS_DOORS[Number(floor)]).toBeDefined()
    }
  })

  it('ont leur figure dans le dossier de leur étage', () => {
    for (const [floor, boss] of bosses) {
      const { bodies, heads } = boss!.figure
      for (const image of [...Object.values(bodies).map(({ src }) => src), ...Object.values(heads)]) {
        expect(image).toMatch(new RegExp(`^/images/boss/${floor}/`))
        expect(existsSync(join(publicDir, image))).toBe(true)
      }
    }
  })
})
