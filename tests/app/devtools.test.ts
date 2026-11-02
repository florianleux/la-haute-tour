import { describe, expect, it } from 'vitest'
import { isDevtoolsShortcut, looksDocked } from '../../utils/devtools'

const press = (code: string, keys: Partial<Record<'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey', boolean>> = {}) => ({
  code,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  altKey: false,
  ...keys,
})

describe('les outils de développement', () => {
  it('reconnaît les raccourcis qui les ouvrent', () => {
    expect(isDevtoolsShortcut(press('F12'))).toBe(true)
    expect(isDevtoolsShortcut(press('KeyI', { ctrlKey: true, shiftKey: true }))).toBe(true)
    expect(isDevtoolsShortcut(press('KeyJ', { metaKey: true, altKey: true }))).toBe(true)
  })

  it('laisse passer les raccourcis voisins', () => {
    expect(isDevtoolsShortcut(press('KeyI', { ctrlKey: true }))).toBe(false)
    expect(isDevtoolsShortcut(press('KeyC', { metaKey: true }))).toBe(false)
    expect(isDevtoolsShortcut(press('KeyK', { ctrlKey: true, shiftKey: true }))).toBe(false)
  })

  it('voit un panneau ancré à l écart entre fenêtre et page', () => {
    expect(looksDocked({ outerWidth: 1600, innerWidth: 1000, outerHeight: 900, innerHeight: 820 })).toBe(true)
    expect(looksDocked({ outerWidth: 1600, innerWidth: 1600, outerHeight: 900, innerHeight: 820 })).toBe(false)
  })
})
