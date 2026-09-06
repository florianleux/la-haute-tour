import { useWriteThenReplace } from './useWriteThenReplace'
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

  const { pending: writing, failed: actionFailed, send } = useWriteThenReplace(data)

  // Le geste ne s'arrête pas à l'écriture : quand elle est refusée, il relit. Le
  // bouton doit rester occupé jusque-là — relâché à l'écriture, il cesserait de
  // tourner pendant que l'interrupteur change encore d'étiquette sous les yeux
  // de l'admin.
  const rereading = ref(false)

  async function set(closed: boolean): Promise<boolean> {
    const sent = await send(() => $fetch<MaintenanceResponse>('/api/admin/maintenance', {
      method: 'POST',
      body: { closed },
    }))

    if (sent) {
      return true
    }

    // L'état affiché ne doit pas rester sur ce qu'on espérait : on relit.
    rereading.value = true
    await refresh()
    rereading.value = false

    return false
  }

  return {
    since: computed(() => data.value?.since ?? null),
    failed: computed(() => Boolean(error.value) || actionFailed.value),
    pending: computed(() => writing.value || rereading.value),
    set,
  }
}
