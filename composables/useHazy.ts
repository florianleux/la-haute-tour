import type { Ref } from 'vue'

/**
 * L'écran est intoxiqué : tenu par la page de jeu (isHazy), lu par ce qui change
 * d'aspect avec lui. Voir specs/champignon.md.
 */
export function useHazy(): Ref<boolean> {
  return useState('hazy', () => false)
}
