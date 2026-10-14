import { describe, expect, it } from 'vitest'
import { offeredTargets } from '../../utils/teams'
import { castHeadline, castOutcome } from '../../utils/spells'

// Voir specs/equipes.md#le-joueur-sans-équipe.
describe('catégories de cible proposées', () => {
  it('propose les trois à qui a une équipe', () => {
    expect(offeredTargets(true)).toEqual(['self', 'ally', 'foe'])
  })

  it('ne propose que Soi à qui n en a pas', () => {
    expect(offeredTargets(false)).toEqual(['self'])
  })
})

// La cible n'est pas annoncée avant le lancer ; elle l'est après, sur la page
// d'où il part. Voir specs/bonus.md#tirage-de-la-cible.
describe('ce que le lancer a touché', () => {
  it('ne nomme pas le joueur qui s est visé lui-même', () => {
    expect(castOutcome('VITALITY', 'self', 'bilbo')).toBe('Vitalité est posé sur toi.')
  })

  it('nomme la cible tirée', () => {
    expect(castOutcome('PURGE', 'foe', 'samsagace')).toBe('Purge est parti sur samsagace.')
  })

  it('dit l exemplaire dépensé quand personne n était à toucher', () => {
    expect(castOutcome('RESPITE', 'ally', null))
      .toBe('Répit n\'a trouvé personne à toucher : l\'exemplaire est dépensé quand même.')
  })
})

// Le titre qui jaillit à la fin de l'animation du lancer : la même règle, en
// plus court.
describe('le titre du lancer', () => {
  it('dit toi au joueur qui s est visé lui-même', () => {
    expect(castHeadline('self', 'bilbo')).toEqual(['Sort lancé sur', 'toi !'])
  })

  it('nomme la cible tirée', () => {
    expect(castHeadline('foe', 'samsagace')).toEqual(['Sort lancé sur', 'samsagace !'])
  })

  it('dit le sort perdu quand personne n était à toucher', () => {
    expect(castHeadline('ally', null)).toEqual(['Sort perdu :', 'personne à toucher'])
  })
})
