import { computed, reactive, ref } from 'vue'
import { vi } from 'vitest'
import type { Mock } from 'vitest'
import { CURRENT_USER_KEY } from '../../composables/useCurrentUser'
import type { MeResponse, SessionUser } from '../../server/api/auth/me.get'

export interface AppStubs {
  /** What useAsyncData resolves to, per key. */
  payloads: Map<string, unknown>
  /** What useAsyncData exposes as `error`, per key. */
  errors: Map<string, unknown>
  /** Every route navigateTo() was asked for, in order. */
  navigations: string[]
  /** Fetches, cache drops and navigations in the one order they happened. */
  calls: string[]
  /** Stands in for the useAsyncData refresh. */
  refresh: Mock<() => Promise<void>>
  /** Back to a signed-out player, no recorded call, a working network. */
  reset: () => void
  /** Makes $fetch reject until the next reset(), as a dead network would. */
  breakFetch: () => void
  signIn: (user: SessionUser) => void
}

export const testUser: SessionUser = {
  id: 1,
  username: 'gandalf',
  isAdmin: false,
  createdAt: '2026-09-01T10:00:00.000Z',
}

export const testAdmin: SessionUser = { ...testUser, id: 2, username: 'saruman', isAdmin: true }

/**
 * The Nuxt app auto-imports don't exist under plain Vitest — same trick as
 * installNitroGlobals, on the app side. Lets middleware and composables be
 * imported and driven directly, without booting a Nuxt instance.
 *
 * The useAsyncData stub is keyed like the real one, so a test says what a given
 * key resolves to and the composable under test reads its own key — no stub is
 * wired to one payload shape.
 */
export function installAppGlobals(): AppStubs {
  // Reactive: the composables under test read these through computed(), which
  // tracks a reactive Map's get/has but never a plain one's.
  const payloads = reactive(new Map<string, unknown>())
  const errors = reactive(new Map<string, unknown>())
  const navigations: string[] = []
  const calls: string[] = []
  const refresh = vi.fn(async (): Promise<void> => {})
  let fetchRejection: unknown = null

  const currentUser = computed<SessionUser | null>(
    () => (payloads.get(CURRENT_USER_KEY) as MeResponse | undefined)?.user ?? null,
  )

  Object.assign(globalThis, {
    defineNuxtRouteMiddleware: <T>(middleware: T): T => middleware,
    useCurrentUser: async () => ({ user: currentUser, refresh }),
    useAsyncData: async (
      key: string,
      _handler: unknown,
      options?: { default?: () => unknown },
    ) => ({
      data: computed(() => (payloads.has(key) ? payloads.get(key) : options?.default?.() ?? null)),
      error: computed(() => errors.get(key) ?? null),
      refresh,
    }),
    clearNuxtData: (): void => {
      payloads.clear()
      calls.push('clear cache')
    },
    useRequestHeaders: () => ({}),
    ref,
    computed,
    $fetch: vi.fn(async (url: string, options?: { method?: string }) => {
      calls.push(`fetch ${options?.method ?? 'GET'} ${url}`)
      if (fetchRejection) {
        throw fetchRejection
      }
      return { ok: true }
    }),
    navigateTo: (to: string): string => {
      navigations.push(to)
      calls.push(`navigate ${to}`)
      return to
    },
  })

  return {
    payloads,
    errors,
    navigations,
    calls,
    refresh,
    reset: (): void => {
      payloads.clear()
      errors.clear()
      navigations.length = 0
      calls.length = 0
      refresh.mockClear()
      fetchRejection = null
      payloads.set(CURRENT_USER_KEY, { user: null } satisfies MeResponse)
    },
    breakFetch: (): void => {
      fetchRejection = new Error('network unreachable')
    },
    signIn: (user: SessionUser): void => {
      payloads.set(CURRENT_USER_KEY, { user } satisfies MeResponse)
    },
  }
}
