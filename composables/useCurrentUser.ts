import type { Ref } from 'vue'
import type { MeResponse, SessionUser } from '~~/server/api/auth/me.get'

/** Cache key of the identity read, shared with whoever has to drop it. */
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
 * The useAsyncData/$fetch shape is repeated in useGameState() on purpose: hiding
 * it behind a generic wrapper loses the typed route inference and the call stops
 * type-checking. Only the cookie forwarding is shared, via useApiFetchOptions().
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
