import type { Ref } from 'vue'
import type { FocusLossesResponse } from '~~/server/api/admin/focus-losses.get'
import type { FocusLossTally } from '~~/server/utils/focus'

/** Cache key of the focus-loss read: one name, so nobody re-types the string. */
export const ADMIN_FOCUS_LOSSES_KEY = 'admin-focus-losses'

export interface AdminFocusLosses {
  players: Ref<FocusLossTally[]>
  /** True when the tally could not be read: an empty tally would be a lie. */
  failed: Ref<boolean>
  loading: Ref<boolean>
  refresh: () => Promise<void>
}

/**
 * Les pertes de focus, joueur par joueur. Lecture seule : ces flags s'observent,
 * ils ne s'arbitrent pas. Voir specs/anti-triche.md#flags-côté-admin.
 */
export async function useAdminFocusLosses(): Promise<AdminFocusLosses> {
  const { data, error, status, refresh } = await useAsyncData<FocusLossesResponse>(
    ADMIN_FOCUS_LOSSES_KEY,
    () => $fetch<FocusLossesResponse>('/api/admin/focus-losses', useApiFetchOptions()),
    { default: (): FocusLossesResponse => ({ players: [] }) },
  )

  return {
    players: computed<FocusLossTally[]>(() => data.value?.players ?? []),
    failed: computed<boolean>(() => Boolean(error.value)),
    loading: computed<boolean>(() => status.value === 'pending'),
    refresh,
  }
}
