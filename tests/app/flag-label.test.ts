import { describe, expect, it } from 'vitest'
import { splitFlagLabel } from '../../utils/flagLabel'

// specs/boss-etage1-drapeaux.md#déroulement-dune-épreuve
describe('la réponse d un drapeau', () => {
  it('passe ce qui suit la virgule en sous-titre, la date au bout', () => {
    expect(splitFlagLabel('État du Katanga (1960-1963), sécession du Congo'))
      .toEqual({ name: 'État du Katanga', detail: 'Sécession du Congo (1960-1963)' })
  })

  it('garde le sous-titre tel quel sans date', () => {
    expect(splitFlagLabel('Åland, archipel autonome de Finlande'))
      .toEqual({ name: 'Åland', detail: 'Archipel autonome de Finlande' })
  })

  it('garde une date déjà dans le sous-titre', () => {
    expect(splitFlagLabel('Transvaal, la « Vierkleur » (1857-1902)'))
      .toEqual({ name: 'Transvaal', detail: 'La « Vierkleur » (1857-1902)' })
  })

  it('laisse entière une réponse sans virgule', () => {
    expect(splitFlagLabel('Yémen du Sud (1967-1990)')).toEqual({ name: 'Yémen du Sud (1967-1990)', detail: null })
    expect(splitFlagLabel('Portugal')).toEqual({ name: 'Portugal', detail: null })
  })
})
