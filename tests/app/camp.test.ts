import { describe, expect, it } from 'vitest'
import { campDoorLine, campObjects } from '../../utils/camp'

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

// specs/boss.md#attendre-au-camp : les clés sur deux, sans les noms.
describe('porte vue du camp', () => {
  const door = { unlocked: false, opened: false, hasKey: false, keyHolders: ['frodon'], spot: 'camp' as const }

  it('compte les clés posées, sans nommer les poseurs', () => {
    expect(campDoorLine(door)).toBe('La porte attend ses clés : 1 sur 2.')
    expect(campDoorLine({ ...door, keyHolders: [] })).toBe('La porte attend ses clés : 0 sur 2.')
  })

  it('dit la porte déverrouillée', () => {
    expect(campDoorLine({ ...door, unlocked: true, keyHolders: ['frodon', 'sam'] })).toBe('La porte est déverrouillée.')
  })
})
