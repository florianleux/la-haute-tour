/**
 * Le mur mobile est-il affiché ? Lu sur le mur lui-même et non redemandé au
 * navigateur : c'est le CSS (variante `mobile`, assets/css/main.css) qui en
 * décide, une seule fois. Caché, il n'a pas d'`offsetParent`. Le jeu, monté
 * derrière, s'en sert pour ne rien faire de ce que le joueur ne voit pas. Voir
 * specs/ecrans.md#mur-mobile.
 */
export function behindMobileWall(): boolean {
  return globalThis.document?.getElementById('mobile-wall')?.offsetParent != null
}
