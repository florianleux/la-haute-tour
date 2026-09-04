import { useWriteThenRead } from './useWriteThenRead'
import type { Ref } from 'vue'
import type { PendingDisputesResponse } from '~~/server/api/admin/disputes/index.get'
import type { DisputeVerdict, PendingDispute } from '~~/server/utils/disputes'

/** Cache key of the dispute queue read: one name, so nobody re-types the string. */
export const ADMIN_DISPUTES_KEY = 'admin-disputes'

export interface AdminDisputes {
  disputes: Ref<PendingDispute[]>
  /** True when the queue could not be read: an empty queue would be a lie. */
  failed: Ref<boolean>
  loading: Ref<boolean>
  /** True from the moment a verdict is sent until the queue has been read back. */
  settling: Ref<boolean>
  settle: (id: number, verdict: DisputeVerdict) => Promise<boolean>
  refresh: () => Promise<void>
}

/**
 * La file de contestation, telle que l'admin la voit dès sa connexion. Admin
 * seulement — la garde serveur est ce qui protège. Voir specs/admin.md.
 */
export async function useAdminDisputes(): Promise<AdminDisputes> {
  const { data, error, status, refresh } = await useAsyncData<PendingDisputesResponse>(
    ADMIN_DISPUTES_KEY,
    () => $fetch<PendingDisputesResponse>('/api/admin/disputes', useApiFetchOptions()),
    { default: (): PendingDisputesResponse => ({ disputes: [] }) },
  )

  const { pending: settling, send } = useWriteThenRead(refresh)

  return {
    disputes: computed<PendingDispute[]>(() => data.value?.disputes ?? []),
    failed: computed<boolean>(() => Boolean(error.value)),
    loading: computed<boolean>(() => status.value === 'pending'),
    settling,
    settle: (id, verdict) => send(`/api/admin/disputes/${id}`, 'PUT', { verdict }),
    refresh,
  }
}
