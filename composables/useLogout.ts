import type { Ref } from 'vue'
import { CURRENT_USER_KEY } from './useCurrentUser'
import { GAME_STATE_KEY } from './useGameState'

export interface Logout {
  logout: () => Promise<void>
  /** True when the server refused to close the session: the page says so. */
  failed: Ref<boolean>
}

/**
 * Ends the auth session. Kept apart from useCurrentUser(), which only reads:
 * this one writes — it clears the session, drops the cached reads and navigates.
 */
export function useLogout(): Logout {
  const failed = ref(false)

  async function logout(): Promise<void> {
    failed.value = false

    try {
      await $fetch('/api/auth/logout', { method: 'POST' })
    }
    catch {
      // Still signed in as far as the server is concerned: say it rather than
      // navigate to a login page that would bounce straight back.
      failed.value = true
      return
    }

    // Both cached reads still describe the player who just left. Without this,
    // /login reads a signed-in player from the cache and sends them home again.
    await refreshNuxtData([CURRENT_USER_KEY, GAME_STATE_KEY])
    await navigateTo('/login')
  }

  return { logout, failed }
}
