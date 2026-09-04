import { describe, expect, it } from 'vitest'
import { advancesOnEnter } from '../../utils/keyboard'
import type { EnterPress, EnterTarget } from '../../utils/keyboard'

/** Un appui, tel que le navigateur le décrit, réduit à ce qui décide. */
function press(key: string, target: EnterTarget | null = null): EnterPress {
  return { key, target }
}

describe('Entrée fait passer à la suite', () => {
  it('enchaîne quand rien n a le focus', () => {
    expect(advancesOnEnter(press('Enter'), true)).toBe(true)
  })

  it('ne fait rien quand il n y a rien à enchaîner', () => {
    expect(advancesOnEnter(press('Enter'), false)).toBe(false)
  })

  it('ignore les autres touches', () => {
    expect(advancesOnEnter(press('a'), true)).toBe(false)
    expect(advancesOnEnter(press(' '), true)).toBe(false)
  })

  it('ne se répète pas quand la touche reste enfoncée', () => {
    expect(advancesOnEnter({ ...press('Enter'), repeat: true }, true)).toBe(false)
  })

  it('rend la touche au champ de saisie : là, Entrée répond', () => {
    expect(advancesOnEnter(press('Enter', { tagName: 'INPUT' }), true)).toBe(false)
    expect(advancesOnEnter(press('Enter', { tagName: 'TEXTAREA' }), true)).toBe(false)
    expect(advancesOnEnter(press('Enter', { tagName: 'SELECT' }), true)).toBe(false)
  })

  it('rend la touche au bouton ou au lien qui a le focus : il s active déjà seul', () => {
    // Sans ça, un appui sur « Contester » contesterait et passerait à la suite.
    expect(advancesOnEnter(press('Enter', { tagName: 'BUTTON' }), true)).toBe(false)
    expect(advancesOnEnter(press('Enter', { tagName: 'A' }), true)).toBe(false)
  })

  it('rend la touche à un contenu éditable', () => {
    expect(advancesOnEnter(press('Enter', { tagName: 'DIV', isContentEditable: true }), true))
      .toBe(false)
  })

  it('enchaîne depuis un élément ordinaire', () => {
    expect(advancesOnEnter(press('Enter', { tagName: 'DIV' }), true)).toBe(true)
  })
})
