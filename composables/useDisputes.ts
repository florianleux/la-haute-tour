import { useWriteThenRead } from './useWriteThenRead'
import type { Ref } from 'vue'
import type { ContestableResponse } from '~~/server/api/game/contestable.get'
import type { ContestableError } from '~~/server/utils/disputes'

/** Cache key of the contestable errors read: one name, so nobody re-types the string. */
export const CONTESTABLE_KEY = 'contestable-errors'

export interface Disputes {
  /** Les erreurs de la tentative que le joueur peut encore contester. */
  errors: Ref<ContestableError[]>
  /** Cette question est-elle encore contestable ? */
  isContestable: (questionId: string) => boolean
  /** Conteste une question. Rend false si le serveur a refusé. */
  contest: (questionId: string) => Promise<boolean>
  contesting: Ref<boolean>
  failed: Ref<boolean>
  refresh: () => Promise<void>
}

/**
 * Ce que le joueur peut contester, et le bouton qui le fait. Le serveur décide
 * seul de ce qui est contestable — une réponse vide, une erreur d'une tentative
 * passée ou une question déjà contestée n'apparaissent jamais ici.
 * Voir specs/validation.md#contestation.
 */
export async function useDisputes(): Promise<Disputes> {
  const { data, error, refresh } = await useAsyncData<ContestableResponse>(
    CONTESTABLE_KEY,
    () => $fetch<ContestableResponse>('/api/game/contestable', useApiFetchOptions()),
    { default: (): ContestableResponse => ({ errors: [] }) },
  )

  const { pending: contesting, send } = useWriteThenRead(refresh)
  const errors = computed<ContestableError[]>(() => data.value?.errors ?? [])

  return {
    errors,
    isContestable: questionId => errors.value.some(error => error.questionId === questionId),
    contest: questionId => send('/api/game/disputes', 'POST', { questionId }),
    contesting,
    failed: computed<boolean>(() => Boolean(error.value)),
    refresh,
  }
}
