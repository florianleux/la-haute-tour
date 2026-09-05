import type { Ref } from 'vue'
import type { MaintenanceResponse } from '~~/server/api/admin/maintenance.post'

/** Cache key of the maintenance read: one name, so nobody re-types the string. */
export const MAINTENANCE_KEY = 'admin-maintenance'

export interface Maintenance {
  /** Depuis quand le jeu est fermé aux joueurs, en ISO 8601. Null s'il est ouvert. */
  since: Ref<string | null>
  /** La lecture a échoué : on ne sait pas, et on ne le devine pas. */
  failed: Ref<boolean>
  pending: Ref<boolean>
  /** Ferme ou rouvre le jeu. Rend false quand l'action n'est pas partie. */
  set: (closed: boolean) => Promise<boolean>
}

/**
 * L'interrupteur de maintenance, côté administration. Voir specs/admin.md#maintenance.
 */
export async function useMaintenance(): Promise<Maintenance> {
  const { data, error, refresh } = await useAsyncData<MaintenanceResponse>(
    MAINTENANCE_KEY,
    () => $fetch<MaintenanceResponse>('/api/admin/maintenance', useApiFetchOptions()),
    { default: (): MaintenanceResponse => ({ since: null }) },
  )

  const pending = ref(false)
  const actionFailed = ref(false)

  async function set(closed: boolean): Promise<boolean> {
    pending.value = true
    actionFailed.value = false

    try {
      data.value = await $fetch<MaintenanceResponse>('/api/admin/maintenance', {
        method: 'POST',
        body: { closed },
      })
      return true
    }
    catch {
      actionFailed.value = true
      // L'état affiché ne doit pas rester sur ce qu'on espérait : on relit.
      await refresh()
      return false
    }
    finally {
      pending.value = false
    }
  }

  return {
    since: computed(() => data.value?.since ?? null),
    failed: computed(() => Boolean(error.value) || actionFailed.value),
    pending,
    set,
  }
}
