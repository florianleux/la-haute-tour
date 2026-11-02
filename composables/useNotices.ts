import { useAchievementAnnouncer } from './useAchievementToasts'
import { useWriteThenReplace } from './useWriteThenReplace'
import type { Ref } from 'vue'
import type { DisputeNotice, NoticeRead, Notices, SpellNotice } from '~~/server/utils/notices'
import type { NoticesReadBody } from '~~/server/api/game/notices/read.post'

/** Cache key of the notices read: one name, so nobody re-types the string. */
export const NOTICES_KEY = 'notices'

export interface UseNotices {
  disputes: Ref<DisputeNotice[]>
  spells: Ref<SpellNotice[]>
  /** Une lecture est en vol : les boutons attendent. */
  pending: Ref<boolean>
  /** « OK » sur une nouvelle, ou « Tout marquer lu » : les identifiants lus. */
  read: (read: NoticeRead) => Promise<void>
  /**
   * Annonce en toast les succès débloqués sans lui, puis les date. Au montage
   * seulement : le rendu serveur lit aussi les nouvelles, et un toast joué là
   * ne serait jamais vu.
   */
  announceWaiting: () => Promise<void>
}

function postRead(body: NoticesReadBody): Promise<Notices> {
  return $fetch<Notices>('/api/game/notices/read', { method: 'POST', body, ...useApiFetchOptions() })
}

/**
 * Ce qui est arrivé au joueur sans lui, lu sur le poster du camp. Monté au camp
 * seulement : aucun chrono n'y tourne, rien ne s'annonce pendant une question.
 *
 * Les succès débloqués sans lui s'annoncent en toast au montage, puis sont
 * datés pour ne pas revenir. Voir specs/ecrans.md#nouvelles.
 */
export async function useNotices(): Promise<UseNotices> {
  // Pris avant l'attente : passé le premier `await`, le contexte Nuxt n'y est plus.
  const announce = useAchievementAnnouncer()
  const { data } = await useAsyncData<Notices>(NOTICES_KEY, () => $fetch<Notices>('/api/game/notices', useApiFetchOptions()))
  const { pending, send } = useWriteThenReplace(data)

  return {
    disputes: computed(() => data.value?.disputes ?? []),
    spells: computed(() => data.value?.spells ?? []),
    pending,
    read: async (read) => {
      await send(() => postRead({ kind: 'notices', ...read }))
    },
    announceWaiting: async () => {
      const ids = data.value?.achievements ?? []
      if (ids.length) {
        announce(ids)
        await send(() => postRead({ kind: 'achievements', ids }))
      }
    },
  }
}
