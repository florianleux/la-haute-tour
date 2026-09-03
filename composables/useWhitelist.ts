import type { Ref } from 'vue'
import type { WhitelistEntry, WhitelistResponse } from '~~/server/api/admin/whitelist.get'

/** Cache key of the whitelist read: one name, so nobody re-types the string. */
export const WHITELIST_KEY = 'admin-whitelist'

export interface AdminWhitelist {
  entries: Ref<WhitelistEntry[]>
  /** True when the list could not be read: an empty list would be a lie. */
  failed: Ref<boolean>
  /** Adds one Discord ID; answers whether the list now holds it. */
  add: (discordId: string) => Promise<boolean>
  /** True from the moment the ID is sent until the list has been read back. */
  adding: Ref<boolean>
  /** True while a page of the list is on its way. */
  loading: Ref<boolean>
  refresh: () => Promise<void>
}

/**
 * The Discord IDs allowed to sign up. Admin only — the server guard is what
 * protects it, this just reads and writes it back. See specs/admin.md.
 */
export async function useWhitelist(): Promise<AdminWhitelist> {
  const { data, error, status, refresh } = await useAsyncData<WhitelistResponse>(
    WHITELIST_KEY,
    () => $fetch<WhitelistResponse>('/api/admin/whitelist', useApiFetchOptions()),
    { default: (): WhitelistResponse => ({ entries: [] }) },
  )

  const adding = ref(false)

  async function add(discordId: string): Promise<boolean> {
    adding.value = true

    try {
      await $fetch('/api/admin/whitelist', { method: 'POST', body: { discordId } })
    }
    catch {
      // The caller decides what to say: a refused write and an unreadable list
      // are two different pieces of news.
      adding.value = false
      return false
    }

    // Relâché après la relecture : la liste n'est à jour qu'ensuite.
    await refresh()
    adding.value = false

    return true
  }

  return {
    entries: computed<WhitelistEntry[]>(() => data.value?.entries ?? []),
    failed: computed<boolean>(() => Boolean(error.value)),
    add,
    adding,
    loading: computed<boolean>(() => status.value === 'pending'),
    refresh,
  }
}
