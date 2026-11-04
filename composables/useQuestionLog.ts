import type { Ref } from 'vue'
import type { QuestionLogEntryView, QuestionLogPage } from '~~/server/utils/game'
import { QUESTION_PAGE_SIZE } from '~~/shared/utils/questionLog'
import type { QuestionLogTab } from '~~/shared/utils/questionLog'

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
  /** Du texte libre et un code de catégorie ; vides, ils ne filtrent rien. */
  search: Ref<string>
  category: Ref<string>
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
  const search = ref('')
  const category = ref('')
  // Une lecture plus ancienne qui revient après une plus récente (frappe
  // rapide) ne doit pas écraser la page affichée.
  let latest = 0

  const pageCount = computed(() => Math.max(1, Math.ceil(total.value / QUESTION_PAGE_SIZE)))

  async function load(wanted: number): Promise<void> {
    const mine = ++latest
    loading.value = true
    failed.value = false

    try {
      const body = await $fetch<QuestionLogPage>('/api/game/question-log', {
        query: {
          page: wanted,
          filter: tab,
          ...(search.value && { q: search.value }),
          ...(category.value && { category: category.value }),
        },
      })

      if (mine !== latest) {
        return
      }

      entries.value = body.entries
      // Compté en page 1 seulement : au-delà, le serveur rend null et le total
      // lu reste le bon.
      total.value = body.total ?? total.value
      poolSuccessesToLeave.value = body.poolSuccessesToLeave
      page.value = wanted
      loaded.value = true
    }
    catch {
      failed.value = mine === latest ? true : failed.value
    }
    finally {
      loading.value = mine === latest ? false : loading.value
    }
  }

  return { entries, page, pageCount, poolSuccessesToLeave, loading, loaded, failed, search, category, load }
}
