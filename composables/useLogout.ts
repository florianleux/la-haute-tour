import type { Ref } from 'vue'

export interface Logout {
  logout: () => Promise<void>
  /** True while the request is in flight, so the button can say so. */
  pending: Ref<boolean>
  /** True when the server refused to close the session: the page says so. */
  failed: Ref<boolean>
}

/**
 * Ends the auth session. Kept apart from useCurrentUser(), which only reads:
 * this one writes — it clears the session, drops the cached reads and navigates.
 */
export function useLogout(): Logout {
  const failed = ref(false)
  const pending = ref(false)

  async function logout(): Promise<void> {
    failed.value = false
    pending.value = true

    try {
      await $fetch('/api/auth/logout', { method: 'POST' })
    }
    catch {
      // Still signed in as far as the server is concerned: say it rather than
      // navigate to a login page that would bounce straight back.
      failed.value = true
      pending.value = false
      return
    }

    // Every cached read still describes the player who just left — identity,
    // game state, and whatever a later screen caches. Dropping the lot beats
    // listing keys someone will forget to extend. Without it, /login reads a
    // signed-in player from the cache and sends them home again.
    clearNuxtData()
    await navigateTo('/login')

    // Relâché seulement ici : le bouton reste occupé jusqu'à la page suivante.
    pending.value = false
  }

  return { logout, pending, failed }
}
