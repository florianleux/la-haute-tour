import { useWriteThenRead } from './useWriteThenRead'
import type { Ref } from 'vue'
import type { WhitelistEntry, WhitelistResponse } from '~~/server/api/admin/whitelist/index.get'
import type { TeamId } from '~~/shared/utils/teams'

/** Cache key of the whitelist read: one name, so nobody re-types the string. */
export const WHITELIST_KEY = 'admin-whitelist'

export interface AdminWhitelist {
  entries: Ref<WhitelistEntry[]>
  /** True when the list could not be read: an empty list would be a lie. */
  failed: Ref<boolean>
  /** Ajoute un Discord ID avec son équipe d'arrivée ; dit si la liste le porte. */
  add: (discordId: string, team: TeamId | null) => Promise<boolean>
  /** True from the moment the ID is sent until the list has been read back. */
  adding: Ref<boolean>
  /** Désinvite un Discord ID ; dit si la liste l'a bien lâché. */
  remove: (discordId: string) => Promise<boolean>
  /**
   * Le Discord ID en cours de retrait, null sinon. L'identifiant plutôt qu'un
   * booléen : c'est la ligne visée qui doit s'occuper, pas toutes les autres.
   */
  removing: Ref<string | null>
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

  const { pending: adding, send } = useWriteThenRead(refresh)
  // Son propre envoi : partagé avec l'ajout, un retrait ferait tourner le loader
  // du bouton « Ajouter », qui n'a rien demandé.
  const { send: sendRemoval } = useWriteThenRead(refresh)
  const removing = ref<string | null>(null)

  async function remove(discordId: string): Promise<boolean> {
    removing.value = discordId

    try {
      return await sendRemoval(`/api/admin/whitelist/${discordId}`, 'DELETE')
    }
    finally {
      removing.value = null
    }
  }

  return {
    entries: computed<WhitelistEntry[]>(() => data.value?.entries ?? []),
    failed: computed<boolean>(() => Boolean(error.value)),
    add: (discordId, team) => send('/api/admin/whitelist', 'POST', { discordId, team }),
    adding,
    remove,
    removing,
    loading: computed<boolean>(() => status.value === 'pending'),
    refresh,
  }
}
