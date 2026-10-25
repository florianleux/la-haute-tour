import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { BOSS_DOORS, type BossDoorEntry } from '../../utils/bossDoors'

const publicDir = fileURLToPath(new URL('../../public', import.meta.url))

const doors = Object.values(BOSS_DOORS).filter((door): door is BossDoorEntry => door !== undefined)

/** Les deux pourcentages d'une serrure, `left-[x%] top-[y%]`. */
function keyholeAt(keyhole: string): number[] {
  const match = /^left-\[([\d.]+)%\] top-\[([\d.]+)%\]$/.exec(keyhole)
  expect(match).not.toBeNull()
  return [Number(match![1]), Number(match![2])]
}

// Le format 20:9 des illustrations se vérifie avec les autres décors, dans backdrops.test.ts.
describe('les portes de boss', () => {
  it('ont toutes une illustration de phase de boss qui existe', () => {
    for (const door of doors) {
      expect(door.image).toMatch(/^\/images\/boss\//)
      expect(existsSync(join(publicDir, door.image))).toBe(true)
    }
  })

  it('posent leurs serrures sur la scène', () => {
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
