import { useWriteThenRead } from './useWriteThenRead'
import type { Ref } from 'vue'
import type { PlayersResponse } from '~~/server/api/admin/players/index.get'
import type { PlayerCard } from '~~/server/utils/players'
import type { TeamId } from '~~/shared/utils/teams'

/** Cache key of the roster read: one name, so nobody re-types the string. */
export const ADMIN_PLAYERS_KEY = 'admin-players'

export interface AdminPlayers {
  players: Ref<PlayerCard[]>
  /** True when the roster could not be read: an empty roster would be a lie. */
  failed: Ref<boolean>
  loading: Ref<boolean>
  /** True from the moment an action is sent until the roster has been read back. */
  acting: Ref<boolean>
  skipCooldown: (userId: number) => Promise<boolean>
  grantLife: (userId: number) => Promise<boolean>
  /** Met le joueur dans une équipe, ou l'en retire avec null. */
  setTeam: (userId: number, team: TeamId | null) => Promise<boolean>
  refresh: () => Promise<void>
}

/**
 * Les fiches joueurs et les deux gestes de l'administration. Admin seulement —
 * la garde serveur est ce qui protège. Voir specs/admin.md#gestion-des-joueurs.
 */
export async function useAdminPlayers(): Promise<AdminPlayers> {
  const { data, error, status, refresh } = await useAsyncData<PlayersResponse>(
    ADMIN_PLAYERS_KEY,
    () => $fetch<PlayersResponse>('/api/admin/players', useApiFetchOptions()),
    { default: (): PlayersResponse => ({ players: [] }) },
  )

  const { pending: acting, send } = useWriteThenRead(refresh)

  return {
    players: computed<PlayerCard[]>(() => data.value?.players ?? []),
    failed: computed<boolean>(() => Boolean(error.value)),
    loading: computed<boolean>(() => status.value === 'pending'),
    acting,
    skipCooldown: userId => send(`/api/admin/players/${userId}/skip-cooldown`, 'POST'),
    grantLife: userId => send(`/api/admin/players/${userId}/grant-life`, 'POST'),
    setTeam: (userId, team) => send(`/api/admin/players/${userId}/team`, 'PUT', { team }),
    refresh,
  }
}
