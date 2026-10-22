import { describe, expect, it } from 'vitest'
import { isLong } from '../../utils/typography'

// Le panneau de jeu ne défile pas : un texte trop long pour la taille de son
// rôle passe en petit plutôt que d'être coupé. Les seuils viennent de mesures
// sur desktop. Voir components/PlayFrame.vue et components/PlayText.vue.
describe('texte long', () => {
  it.each([
    // L'énoncé posé.
    ['statement', 150],
    // L'énoncé rappelé sous le verdict, bien plus serré.
    ['recall', 100],
    // La bonne réponse, en capitales grasses.
    ['answer', 35],
  ] as const)('%s : taille normale jusqu à %i caractères, réduite au-delà', (role, chars) => {
    expect(isLong(role, 'a'.repeat(chars))).toBe(false)
    expect(isLong(role, 'a'.repeat(chars + 1))).toBe(true)
  })
})
