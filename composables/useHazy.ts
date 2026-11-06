import type { Ref } from 'vue'

/**
 * L'écran est intoxiqué : tenu par la page de jeu (isHazy), lu par ce qui change
 * d'aspect avec lui. Dans un cookie : le serveur dégrise dès la dernière vie, et
 * le verdict de la chute, rechargé, doit rester sous les effets. Voir
 * specs/champignon.md.
 */
export function useHazy(): Ref<boolean> {
  return useCookie<boolean>('hazy', { default: () => false, sameSite: 'lax', maxAge: 60 * 60 * 24 })
}
