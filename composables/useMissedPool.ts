import type { Ref } from 'vue'
import type { MissedPoolEntryView, MissedPoolPage } from '~~/server/utils/game'

export interface MissedPool {
  entries: Ref<MissedPoolEntryView[]>
  total: Ref<number>
  order: Ref<'asc' | 'desc'>
  /** True while a page is on its way, and while more remain to load. */
  loading: Ref<boolean>
  hasMore: Ref<boolean>
  /** False until a first page has come back — an empty list is only known then. */
  loaded: Ref<boolean>
  failed: Ref<boolean>
  loadMore: () => Promise<void>
  /** Flips the sort and reloads from the first page. */
  toggleOrder: () => Promise<void>
}

/**
 * The missed pool of the current floor, ten at a time as the player scrolls. It is
 * a revision sheet: the answers come with it. See specs/ecrans.md.
 */
export function useMissedPool(): MissedPool {
  const entries = ref<MissedPoolEntryView[]>([])
  const total = ref(0)
  const order = ref<'asc' | 'desc'>('desc')
  const loading = ref(false)
  const loaded = ref(false)
  const failed = ref(false)

  const hasMore = computed(() => entries.value.length < total.value)

  async function loadMore(): Promise<void> {
    if (loading.value) {
      return
    }

    loading.value = true
    failed.value = false

    try {
      const page = await $fetch<MissedPoolPage>('/api/game/pool', {
        query: { offset: entries.value.length, order: order.value },
      })
      entries.value = entries.value.concat(page.entries)
      total.value = page.total
      loaded.value = true
    }
    catch {
      failed.value = true
    }
    finally {
      loading.value = false
    }
  }

  async function toggleOrder(): Promise<void> {
    // Pas pendant un chargement : on viderait la liste sans pouvoir la recharger,
    // loadMore() refusant de se relancer, et l'écran resterait vide.
    if (loading.value) {
      return
    }

    order.value = order.value === 'desc' ? 'asc' : 'desc'
    entries.value = []
    await loadMore()
  }

  return { entries, total, order, loading, hasMore, loaded, failed, loadMore, toggleOrder }
}
