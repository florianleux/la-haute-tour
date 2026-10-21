import { advancesOnEnter } from '../utils/keyboard'
import type { EnterTarget } from '../utils/keyboard'
import { behindMobileWall } from '../utils/mobileWall'
import type { MaybeRefOrGetter } from 'vue'

/**
 * Entrée fait passer à la suite. La réponse s'envoie déjà à Entrée : on enchaîne
 * verdict après verdict sans quitter le clavier, ce qui est exactement le rythme
 * que le jeu cherche. Voir specs/ecrans.md#jeu.
 *
 * Rien à débrancher côté tactile : sans clavier, l'événement n'arrive jamais.
 *
 * La suite est tantôt un appel au serveur, tantôt un simple pas de plus dans un
 * dialogue : le raccourci n'attend pas sa fin et ne fait rien de ce qu'elle
 * rend, d'où `unknown` plutôt que la liste des types déjà rencontrés.
 *
 * `ready` dit quand la touche a quelque chose à enchaîner. Un écran qui attend
 * toujours un geste ne le passe pas.
 *
 * `keys` ajoute d'autres touches à Entrée : les flèches d'un dialogue.
 *
 * La décision, elle, vit dans `advancesOnEnter` — testable sans DOM.
 */
export function useAdvanceOnEnter(
  advance: () => unknown,
  ready: MaybeRefOrGetter<boolean> = true,
  keys?: readonly string[],
): void {
  if (!import.meta.client) {
    return
  }

  function onKeydown(event: KeyboardEvent): void {
    // Derrière le mur mobile, le jeu est caché mais monté : sans ça, Entrée y
    // lancerait une question que personne ne voit, et son chrono la soumettrait.
    if (behindMobileWall()) {
      return
    }

    const press = {
      key: event.key,
      repeat: event.repeat,
      target: event.target as EnterTarget | null,
    }

    if (!advancesOnEnter(press, toValue(ready), keys)) {
      return
    }

    // Sans ça, l'appui qui vient d'envoyer une réponse ferait aussi défiler la
    // page jusqu'au bouton suivant.
    event.preventDefault()
    void advance()
  }

  window.addEventListener('keydown', onKeydown)
  onScopeDispose(() => window.removeEventListener('keydown', onKeydown))
}
