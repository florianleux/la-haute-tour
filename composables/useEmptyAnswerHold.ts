import { ref, watch } from 'vue'
import type { Ref } from 'vue'

/** Comment le joueur envoie sa réponse : Entrée dans le champ, ou clic sur Valider. */
export type SendMethod = 'enter' | 'click'

export interface EmptyAnswerHold {
  /** L'envoi vide retenu, qui attend d'être confirmé ; null sinon. */
  heldEmptySend: Readonly<Ref<SendMethod | null>>
  /** Vrai quand cet envoi est retenu plutôt que parti. */
  holds: (method: SendMethod) => boolean
}

/**
 * L'envoi vide retenu (glossaire de specs/spec.md) : une réponse vide coûte une
 * vie, et Entrée vient de passer le verdict — un double appui un peu rapide
 * grillerait la question qui s'affiche. Le premier envoi d'un champ vide ou
 * blanc est donc retenu ; le second, Entrée ou clic, part. Taper dans le champ
 * ou passer à une autre question l'oublie. Voir specs/ecrans.md#ascent--question.
 *
 * Vit dans les cartes qui ont un champ de réponse, pas dans useQuestionRun : le
 * chrono et le départ de la page envoient sans passer par la carte, donc sans
 * rien demander.
 */
export function useEmptyAnswerHold(
  typed: () => string,
  questionId: () => string | undefined,
): EmptyAnswerHold {
  const heldEmptySend = ref<SendMethod | null>(null)

  function release(): void {
    heldEmptySend.value = null
  }

  function holds(method: SendMethod): boolean {
    if (typed().trim() === '' && heldEmptySend.value === null) {
      heldEmptySend.value = method
      return true
    }

    release()
    return false
  }

  // Synchrone : en différé, une frappe juste avant l'envoi effacerait après coup
  // l'envoi que celui-ci vient de retenir.
  watch([typed, questionId], release, { flush: 'sync' })

  return { heldEmptySend, holds }
}
