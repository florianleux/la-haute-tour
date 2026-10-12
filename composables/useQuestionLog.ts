import type { Ref } from 'vue'
import type { QuestionLogEntryView, QuestionLogPage } from '~~/server/utils/game'
import { QUESTION_PAGE_SIZE } from '~~/shared/utils/questionLog'

/**
 * Les trois onglets du Volumen : le Pool Échecs de l'étage, les questions sues,
 * toutes les vues. Voir specs/ecrans.md#volumen.
 */
export type QuestionLogTab = 'missed' | 'correct' | 'all'

export interface QuestionLog {
  entries: Ref<QuestionLogEntryView[]>
  /** La page affichée, de 1 au nombre de pages. */
  page: Ref<number>
  pageCount: Ref<number>
  poolSuccessesToLeave: Ref<number>
  loading: Ref<boolean>
  /** Faux tant qu'aucune page n'est revenue : une liste vide ne se sait qu'alors. */
  loaded: Ref<boolean>
  failed: Ref<boolean>
  /** Lit cette page et la met à la place de celle affichée. */
  load: (page: number) => Promise<void>
}

/** Un onglet du Volumen, vingt questions par page. */
export function useQuestionLog(tab: QuestionLogTab): QuestionLog {
  const entries = ref<QuestionLogEntryView[]>([])
  const total = ref(0)
  const page = ref(1)
  const poolSuccessesToLeave = ref(0)
  const loading = ref(false)
  const loaded = ref(false)
  const failed = ref(false)

  const pageCount = computed(() => Math.max(1, Math.ceil(total.value / QUESTION_PAGE_SIZE)))

  async function load(wanted: number): Promise<void> {
    loading.value = true
    failed.value = false

    try {
      const body = await $fetch<QuestionLogPage>('/api/game/question-log', { query: { page: wanted, filter: tab } })
      entries.value = body.entries
      // Compté en page 1 seulement : au-delà, le serveur rend null et le total
      // lu reste le bon.
      total.value = body.total ?? total.value
      poolSuccessesToLeave.value = body.poolSuccessesToLeave
      page.value = wanted
      loaded.value = true
    }
    catch {
      failed.value = true
    }
    finally {
      loading.value = false
    }
  }

  return { entries, page, pageCount, poolSuccessesToLeave, loading, loaded, failed, load }
}
