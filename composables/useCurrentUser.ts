import type { Ref } from 'vue'
import type { MeResponse, SessionUser } from '~~/server/api/auth/me.get'

export interface CurrentUser {
  user: Ref<SessionUser | null>
  refresh: () => Promise<void>
}

/**
 * The current player, always read back from the server — the client never keeps
 * game state (lives/floor) of its own. See specs/architecture.md.
 *
 * Backed by useAsyncData so route middleware can await it and share the one
 * request with the page that renders right after.
 */
export async function useCurrentUser(): Promise<CurrentUser> {
  const { data, refresh } = await useAsyncData<MeResponse>(
    'current-user',
    () => $fetch<MeResponse>('/api/auth/me', {
      // On SSR the internal call carries no cookie of its own: without this the
      // middleware sees an anonymous visitor and bounces a signed-in player.
      headers: import.meta.server ? useRequestHeaders(['cookie']) : undefined,
    }),
    { default: (): MeResponse => ({ user: null }) },
  )

  return {
    user: computed<SessionUser | null>(() => data.value?.user ?? null),
    refresh,
  }
}
