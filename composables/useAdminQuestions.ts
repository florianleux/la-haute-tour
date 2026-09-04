import { useWriteThenRead } from './useWriteThenRead'
import type { Ref } from 'vue'
import type { AdminQuestionsResponse } from '~~/server/api/admin/questions/index.get'
import type { AdminQuestion, QuestionDraft, QuestionEdit } from '~~/server/utils/questions'

/** Cache key of the deck read: one name, so nobody re-types the string. */
export const ADMIN_QUESTIONS_KEY = 'admin-questions'

export interface AdminQuestions {
  questions: Ref<AdminQuestion[]>
  /** L'étage filtré, ou null pour tout le deck. */
  floor: Ref<number | null>
  /** True when the deck could not be read: an empty deck would be a lie. */
  failed: Ref<boolean>
  /** True while a read is on its way. */
  loading: Ref<boolean>
  /** True from the moment a write is sent until the deck has been read back. */
  saving: Ref<boolean>
  create: (draft: QuestionDraft) => Promise<boolean>
  edit: (id: string, edit: QuestionEdit) => Promise<boolean>
  remove: (id: string) => Promise<boolean>
  refresh: () => Promise<void>
}

/**
 * Le deck vu par l'administration. Admin seulement — la garde serveur est ce qui
 * protège, ceci ne fait que lire et réécrire. Voir specs/admin.md.
 */
export async function useAdminQuestions(): Promise<AdminQuestions> {
  const floor = ref<number | null>(null)

  const { data, error, status, refresh } = await useAsyncData<AdminQuestionsResponse>(
    ADMIN_QUESTIONS_KEY,
    () => $fetch<AdminQuestionsResponse>('/api/admin/questions', {
      ...useApiFetchOptions(),
      query: floor.value === null ? undefined : { floor: floor.value },
    }),
    { default: (): AdminQuestionsResponse => ({ questions: [] }) },
  )

  // Le filtre est une lecture de plus, pas un tri local : le deck peut être long.
  watch(floor, () => refresh())

  const { pending: saving, send } = useWriteThenRead(refresh)

  return {
    questions: computed<AdminQuestion[]>(() => data.value?.questions ?? []),
    floor,
    failed: computed<boolean>(() => Boolean(error.value)),
    loading: computed<boolean>(() => status.value === 'pending'),
    saving,
    create: draft => send('/api/admin/questions', 'POST', draft),
    edit: (id, edit) => send(`/api/admin/questions/${id}`, 'PUT', edit),
    remove: id => send(`/api/admin/questions/${id}`, 'DELETE'),
    refresh,
  }
}
