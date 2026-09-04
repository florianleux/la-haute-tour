/**
 * Ce qu'un appui sur Entrée doit déclencher, dit sans DOM pour rester testable.
 * Voir specs/ecrans.md#jeu.
 */
/** De l'élément focalisé, ce qui décide — et rien de plus. */
export interface EnterTarget {
  tagName?: string
  isContentEditable?: boolean
}

export interface EnterPress {
  key: string
  /** Vrai quand la touche est maintenue : un seul passage par appui. */
  repeat?: boolean
  /** L'élément qui avait le focus. */
  target: EnterTarget | null
}

const TYPING_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT'])
/** Ces éléments s'activent déjà à Entrée : la touche leur appartient. */
const ACTIVATED_TAGS = new Set(['BUTTON', 'A'])

/**
 * Entrée fait passer à la suite — même touche que pour envoyer une réponse, pour
 * qu'on enchaîne sans quitter le clavier.
 *
 * Elle est rendue à l'élément qui a le focus quand il en fait déjà quelque
 * chose : un champ de saisie envoie son formulaire, un bouton ou un lien
 * s'active. Sinon deux choses partiraient d'un seul appui.
 */
export function advancesOnEnter(event: EnterPress, ready: boolean): boolean {
  if (!ready || event.key !== 'Enter' || event.repeat) {
    return false
  }

  const tag = event.target?.tagName ?? ''

  return !TYPING_TAGS.has(tag) && !ACTIVATED_TAGS.has(tag) && !event.target?.isContentEditable
}
