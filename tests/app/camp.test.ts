import { describe, expect, it } from 'vitest'
import { campObjects } from '../../utils/camp'

const newcomer = { team: null, volumen: false, spellbook: false }

describe('objets du camp', () => {
  it('pose la corde et le sac, même pour un joueur neuf sans équipe', () => {
    expect([...campObjects(newcomer)].sort()).toEqual(['backpack', 'rope'])
  })

  it('pose la bannière pour tout joueur qui a une équipe', () => {
    expect(campObjects({ ...newcomer, team: 'MIDI' }).has('banner')).toBe(true)
    expect(campObjects({ ...newcomer, team: 'TLM' }).has('banner')).toBe(true)
  })

  it('pose le parchemin dès la première question vue', () => {
    expect(campObjects({ ...newcomer, volumen: true }).has('scroll')).toBe(true)
  })

  it('pose le grimoire dès le premier sort obtenu', () => {
    expect(campObjects({ ...newcomer, spellbook: true }).has('spellbook')).toBe(true)
  })

  it('pose tout pour un joueur qui a tout découvert', () => {
    expect(campObjects({ team: 'TLM', volumen: true, spellbook: true }).size).toBe(5)
  })
})
