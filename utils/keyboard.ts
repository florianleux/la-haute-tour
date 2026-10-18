/**
 * Ce qu'un appui sur Entrée doit déclencher — et, dans un dialogue, sur les
 * flèches bas et droite —, dit sans DOM pour rester testable.
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

/** Le jeu passe à la suite à Entrée seule ; un dialogue y ajoute ses flèches. */
const ENTER_ONLY: readonly string[] = ['Enter']
export const DIALOGUE_KEYS: readonly string[] = [...ENTER_ONLY, 'ArrowDown', 'ArrowRight']

/**
 * Entrée fait passer à la suite — même touche que pour envoyer une réponse, pour
 * qu'on enchaîne sans quitter le clavier.
 *
 * Elle est rendue à l'élément qui a le focus quand il en fait déjà quelque
 * chose : un champ de saisie envoie son formulaire, un bouton ou un lien
 * s'active. Sinon deux choses partiraient d'un seul appui.
 *
 * `keys` dit quelles touches comptent : Entrée seule par défaut, plus les
 * flèches bas et droite dans un dialogue. Une flèche reste au champ de saisie,
 * qui y déplace son curseur, mais pas à un bouton, qui n'en fait rien.
 */
export function advancesOnEnter(
  event: EnterPress,
  ready: boolean,
  keys: readonly string[] = ENTER_ONLY,
): boolean {
  if (!ready || !keys.includes(event.key) || event.repeat) {
    return false
  }

  const tag = event.target?.tagName ?? ''
  const activates = event.key === 'Enter' && ACTIVATED_TAGS.has(tag)

  return !TYPING_TAGS.has(tag) && !activates && !event.target?.isContentEditable
}
