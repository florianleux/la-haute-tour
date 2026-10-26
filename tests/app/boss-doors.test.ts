import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { BOSS_DOORS, type BossDoorEntry } from '../../utils/bossDoors'

const publicDir = fileURLToPath(new URL('../../public', import.meta.url))

const doors = Object.values(BOSS_DOORS).filter((door): door is BossDoorEntry => door !== undefined)

/** Les trois pourcentages d'une serrure, `left-[x%] top-[y%] w-[w%]`. */
function keyholeAt(keyhole: string): number[] {
  const match = /^left-\[([\d.]+)%\] top-\[([\d.]+)%\] w-\[([\d.]+)%\]$/.exec(keyhole)
  expect(match).not.toBeNull()
  return [Number(match![1]), Number(match![2]), Number(match![3])]
}

// Le format 20:9 des illustrations se vérifie avec les autres décors, dans backdrops.test.ts.
describe('les portes de boss', () => {
  it('ont toutes une illustration, des battants et une clé dans le dossier de leur boss', () => {
    for (const [floor, door] of Object.entries(BOSS_DOORS)) {
      for (const image of [door!.image, ...door!.leaves, door!.key]) {
        // Dans le dossier de son boss : l'écran de chargement du boss l'attend.
        expect(image).toMatch(new RegExp(`^/images/boss/${floor}/`))
        expect(existsSync(join(publicDir, image))).toBe(true)
      }
    }
  })

  it('posent leurs serrures sur leurs battants', () => {
    for (const door of doors) {
      for (const keyhole of door.keyholes) {
        for (const percent of keyholeAt(keyhole)) {
          expect(percent).toBeGreaterThanOrEqual(0)
          expect(percent).toBeLessThanOrEqual(100)
        }
      }
    }
  })
})
