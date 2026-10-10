import type { Ref } from 'vue'
import type { DisputableError } from '~~/server/utils/disputes'
import type { DisputableResponse } from '~~/server/api/game/disputable-errors.get'

/** Cache key of the disputable errors read: one name, so nobody re-types the string. */
export const DISPUTABLE_KEY = 'disputable-errors'

export interface Disputes {
  /** Les erreurs du pool que le joueur peut encore contester. */
  errors: Ref<DisputableError[]>
  /** Cette question est-elle encore contestable ? */
  isDisputable: (questionId: string) => boolean
  /** Conteste une question. Rend false si le serveur a refusé. */
  sendDispute: (questionId: string) => Promise<boolean>
  /** La question en cours de contestation, null quand aucune n'est en vol. */
  disputingId: Ref<string | null>
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
  const errors = useState<DisputableError[]>(DISPUTABLE_KEY, () => [])
  const disputingId = useState<string | null>('disputing-id', () => null)
  const failed = useState<boolean>('disputable-failed', () => false)

  async function refresh(): Promise<void> {
    try {
      const res = await $fetch<DisputableResponse>('/api/game/disputable-errors', useApiFetchOptions())
      errors.value = res.errors
      failed.value = false
    }
    catch {
      failed.value = true
    }
  }

  async function sendDispute(questionId: string): Promise<boolean> {
    disputingId.value = questionId

    try {
      await $fetch('/api/game/disputes', { method: 'POST', body: { questionId } })
      await refresh()
      return true
    }
    catch {
      return false
    }
    finally {
      disputingId.value = null
    }
  }

  return {
    errors,
    isDisputable: questionId => errors.value.some(error => error.questionId === questionId),
    sendDispute,
    disputingId,
    failed,
    refresh,
  }
}
