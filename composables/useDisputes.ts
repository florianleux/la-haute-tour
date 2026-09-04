import type { Ref } from 'vue'
import type { ContestableError } from '~~/server/utils/disputes'
import type { ContestableResponse } from '~~/server/api/game/contestable.get'

/** Cache key of the contestable errors read: one name, so nobody re-types the string. */
export const CONTESTABLE_KEY = 'contestable-errors'

export interface Disputes {
  /** Les erreurs du pool que le joueur peut encore contester. */
  errors: Ref<ContestableError[]>
  /** Cette question est-elle encore contestable ? */
  isContestable: (questionId: string) => boolean
  /** Conteste une question. Rend false si le serveur a refusé. */
  contest: (questionId: string) => Promise<boolean>
  /** La question en cours de contestation, null quand aucune n'est en vol. */
  contestingId: Ref<string | null>
  failed: Ref<boolean>
  refresh: () => Promise<void>
}

/**
 * Ce que le joueur peut contester, et le bouton qui le fait. Le serveur décide
 * seul de ce qui est contestable — une réponse vide, une question déjà contestée
 * ou résolue par perte de focus n'apparaît jamais ici.
 *
 * L'état est partagé via useState : plusieurs composants (le verdict, la liste
 * du pool) peuvent contester la même question sans double-POST ni spinner
 * désynchronisé.
 * Voir specs/validation.md#contestation.
 */
export function useDisputes(): Disputes {
  const errors = useState<ContestableError[]>(CONTESTABLE_KEY, () => [])
  const contestingId = useState<string | null>('contesting-id', () => null)
  const failed = useState<boolean>('contestable-failed', () => false)

  async function refresh(): Promise<void> {
    try {
      const res = await $fetch<ContestableResponse>('/api/game/contestable', useApiFetchOptions())
      errors.value = res.errors
      failed.value = false
    }
    catch {
      failed.value = true
    }
  }

  async function contest(questionId: string): Promise<boolean> {
    contestingId.value = questionId

    try {
      await $fetch('/api/game/disputes', { method: 'POST', body: { questionId } })
      await refresh()
      return true
    }
    catch {
      return false
    }
    finally {
      contestingId.value = null
    }
  }

  return {
    errors,
    isContestable: questionId => errors.value.some(error => error.questionId === questionId),
    contest,
    contestingId,
    failed,
    refresh,
  }
}
