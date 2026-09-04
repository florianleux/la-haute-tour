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
  /** Recherche en texte libre sur l'énoncé, ou '' pour aucune. */
  search: Ref<string>
  /** Le total au-dessus du filtre, pour paginer. */
  total: Ref<number>
  /** La page courante, à partir de 1. */
  page: Ref<number>
  /** Nombre de questions par page. */
  limit: number
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

const PAGE_SIZE = 10
const SEARCH_DEBOUNCE_MS = 300

/**
 * Le deck vu par l'administration, paginé par dix et cherchable. Admin
 * seulement — la garde serveur est ce qui protège, ceci ne fait que lire et
 * réécrire. Voir specs/admin.md.
 */
export async function useAdminQuestions(): Promise<AdminQuestions> {
  const floor = ref<number | null>(null)
  const search = ref('')
  // La recherche part décalée : on ne relit qu'après que le joueur a arrêté
  // de taper, pas à chaque frappe.
  const debouncedSearch = ref('')
  const page = ref(1)
  const limit = PAGE_SIZE

  const { data, error, status, refresh } = await useAsyncData<AdminQuestionsResponse>(
    ADMIN_QUESTIONS_KEY,
    () => $fetch<AdminQuestionsResponse>('/api/admin/questions', {
      ...useApiFetchOptions(),
      query: {
        ...(floor.value === null ? {} : { floor: floor.value }),
        ...(debouncedSearch.value ? { search: debouncedSearch.value } : {}),
        page: page.value,
        limit,
      },
    }),
    { default: (): AdminQuestionsResponse => ({ questions: [], total: 0 }) },
  )

  // Changer d'étage ou de recherche ramène à la première page : la page
  // courante n'existe peut-être plus sous le nouveau filtre.
  watch(floor, () => { page.value = 1 })

  let timer: ReturnType<typeof setTimeout> | null = null
  watch(search, (value) => {
    if (timer) {
      clearTimeout(timer)
    }
    timer = setTimeout(() => {
      debouncedSearch.value = value
      page.value = 1
    }, SEARCH_DEBOUNCE_MS)
  })

  // Le filtre et la page sont des lectures de plus : le deck peut être long,
  // on ne filtre pas en local.
  watch([page, floor, debouncedSearch], () => refresh())

  const { pending: saving, send } = useWriteThenRead(refresh)

  return {
    questions: computed<AdminQuestion[]>(() => data.value?.questions ?? []),
    floor,
    search,
    total: computed<number>(() => data.value?.total ?? 0),
    page,
    limit,
    failed: computed<boolean>(() => Boolean(error.value)),
    loading: computed<boolean>(() => status.value === 'pending'),
    saving,
    create: draft => send('/api/admin/questions', 'POST', draft),
    edit: (id, edit) => send(`/api/admin/questions/${id}`, 'PUT', edit),
    remove: id => send(`/api/admin/questions/${id}`, 'DELETE'),
    refresh,
  }
}
