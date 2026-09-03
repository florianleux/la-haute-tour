import type { Ref } from 'vue'
import type { MeResponse, SessionUser } from '~~/server/api/auth/me.get'

/** Cache key of the identity read: one name, so nobody re-types the string. */
export const CURRENT_USER_KEY = 'current-user'

export interface CurrentUser {
  user: Ref<SessionUser | null>
  refresh: () => Promise<void>
}

/**
 * Who the player is, always read back from the server. Identity only: floor and
 * lives come from useGameState(). See specs/architecture.md.
 *
 * Backed by useAsyncData so route middleware can await it and share the one
 * request with the page that renders right after.
 *
 * La forme useAsyncData/$fetch est répétée dans les autres lectures à dessein :
 * la cacher derrière un module générique tue l'inférence des routes typées.
 * Voir docs/adr/0001-pas-de-wrapper-generique-autour-de-useasyncdata.md.
 */
export async function useCurrentUser(): Promise<CurrentUser> {
  const { data, refresh } = await useAsyncData<MeResponse>(
    CURRENT_USER_KEY,
    () => $fetch<MeResponse>('/api/auth/me', useApiFetchOptions()),
    { default: (): MeResponse => ({ user: null }) },
  )

  return {
    user: computed<SessionUser | null>(() => data.value?.user ?? null),
    refresh,
  }
}
