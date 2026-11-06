import { describe, expect, it } from 'vitest'
import { wikipediaUrl } from '../../utils/wikipedia'

const searched = (label: string): string | null => new URL(wikipediaUrl(label)).searchParams.get('search')

describe('le lien Wikipédia d une réponse', () => {
  it('cherche une personne par son prénom, puis son nom', () => {
    expect(searched('FLEMING (Alexander)')).toBe('Alexander FLEMING')
    expect(searched('TORQUEMADA (Tomás de)')).toBe('Tomás de TORQUEMADA')
  })

  it('laisse une précision hors de la recherche', () => {
    expect(searched('Bombyx du mûrier (ver à soie)')).toBe('Bombyx du mûrier')
    expect(searched('Jean II (Le Bon)')).toBe('Jean II')
  })

  it('cherche le reste tel quel', () => {
    expect(searched('ENIAC')).toBe('ENIAC')
  })

  it('encode les accents et les apostrophes, et demande l article direct', () => {
    expect(wikipediaUrl('Le Désir d\'Ève')).toBe('https://fr.wikipedia.org/w/index.php?search=Le+D%C3%A9sir+d%27%C3%88ve&go=Go')
  })
})
