import { computed, getCurrentScope, onScopeDispose, reactive, ref, watch } from 'vue'
import { vi } from 'vitest'
import type { Mock } from 'vitest'
import { CURRENT_USER_KEY } from '../../composables/useCurrentUser'
import { isRealAdmin } from '../../utils/identity'
import type { MeResponse, SessionUser } from '../../server/api/auth/me.get'

/**
 * Le faux Nuxt vu par un test : ce que le serveur répond, ce que le client a fait.
 * Aucun test ne nomme useAsyncData, useNuxtData ou $fetch — c'est justement ce
 * que ce seam cache.
 */
export interface FakeNuxt {
  /** Ce que le serveur renvoie pour une lecture, par clé. */
  serve: (key: string, payload: unknown) => void
  /** Ce que le serveur renvoie à la prochaine action. */
  answerWith: (value: unknown) => void
  /** La lecture de cette clé échoue. */
  breakRead: (key: string) => void
  /** Le réseau est mort : toute action est refusée. */
  breakNetwork: () => void
  signIn: (user: SessionUser) => void
  /** L'admin incarne un joueur test : le jeu sert celui-ci, les droits restent à l'autre. */
  impersonate: (admin: SessionUser, testPlayer: SessionUser) => void
  signOut: () => void
  /** Ce que la lecture d'une clé rend maintenant — le client a pu l'écrire. */
  cached: (key: string) => unknown
  /** Appels réseau, vidages de cache et navigations, dans l'ordre où ils ont eu lieu. */
  calls: () => string[]
  /** Les routes demandées, dans l'ordre. */
  navigations: () => string[]
  /** Les rechargements complets de l'application, dans l'ordre. */
  reloads: () => string[]
  /** Tient lieu du refresh de useAsyncData. */
  refresh: Mock<() => Promise<void>>
  /** Joueur déconnecté, aucun appel enregistré, réseau qui marche. */
  reset: () => void
}

export const testUser: SessionUser = {
  id: 1,
  username: 'gandalf',
  isAdmin: false,
  createdAt: '2026-09-01T10:00:00.000Z',
}

export const testAdmin: SessionUser = { ...testUser, id: 2, username: 'saruman', isAdmin: true }

/** La fenêtre pendant laquelle Nuxt refuse de recharger deux fois le même chemin. */
const RELOAD_GUARD_MS = 10_000

/**
 * Les auto-imports de Nuxt n'existent pas sous Vitest — même procédé que
 * installNitroGlobals, côté application. Middlewares et composables s'importent
 * et se pilotent directement, sans démarrer d'instance Nuxt.
 *
 * Le stub de useAsyncData est indexé par clé comme le vrai : un test dit ce que
 * telle clé rend, et le composable testé lit la sienne.
 */
export function installAppGlobals(): FakeNuxt {
  // Réactifs : les composables testés les lisent à travers computed(), qui suit
  // un Map réactif mais jamais un Map ordinaire.
  const payloads = reactive(new Map<string, unknown>())
  const errors = reactive(new Map<string, unknown>())
  const navigations: string[] = []
  const reloads: string[] = []
  const calls: string[] = []
  const refresh = vi.fn(async (): Promise<void> => {})
  let fetchRejection: unknown = null
  let fetchResponse: unknown = { ok: true }
  let lastReload: { path: string, expires: number } | null = null

  const identity = computed<MeResponse | null>(
    () => (payloads.get(CURRENT_USER_KEY) as MeResponse | undefined) ?? null,
  )
  const currentUser = computed<SessionUser | null>(() => identity.value?.user ?? null)
  // La même règle que l'application : les droits suivent le compte connecté.
  const currentIsAdmin = computed<boolean>(() => isRealAdmin(identity.value))

  Object.assign(globalThis, {
    defineNuxtRouteMiddleware: <T>(middleware: T): T => middleware,
    useCurrentUser: async () => ({
      user: currentUser,
      impersonator: computed(() => identity.value?.impersonator ?? null),
      testPlayers: computed(() => identity.value?.testPlayers ?? []),
      isAdmin: currentIsAdmin,
      refresh,
    }),
    useApiFetchOptions: () => ({ headers: undefined }),
    useState: <T>(key: string, init: () => T) => {
      if (!payloads.has(key)) {
        payloads.set(key, init())
      }
      return computed<T>({
        get: () => payloads.get(key) as T,
        set: (value: T) => { payloads.set(key, value) },
      })
    },
    useAsyncData: async (
      key: string,
      _handler: unknown,
      options?: { default?: () => unknown },
    ) => ({
      // Assignable comme le vrai : une écriture qui rend la nouvelle vue la pose
      // ici plutôt que de relire. Un computed en lecture seule ferait passer ces
      // composables-là pour muets. Voir composables/useWriteThenReplace.ts.
      data: computed({
        get: () => (payloads.has(key) ? payloads.get(key) : options?.default?.() ?? null),
        set: (value: unknown) => payloads.set(key, value),
      }),
      error: computed(() => errors.get(key) ?? null),
      status: ref('idle'),
      refresh,
    }),
    useNuxtData: (key: string) => ({
      data: computed({
        get: () => payloads.get(key) ?? null,
        set: (value: unknown) => payloads.set(key, value),
      }),
    }),
    clearNuxtData: (): void => {
      payloads.clear()
      calls.push('clear cache')
    },
    // Le garde-fou de Nuxt est modélisé, parce que c'est lui qui mord : le vrai
    // `reloadNuxtApp` retient le dernier rechargement en sessionStorage et avale
    // le suivant vers le même chemin pendant dix secondes, sauf `force`. Un faux
    // qui recharge toujours laisserait passer précisément le bug qu'on a eu.
    reloadNuxtApp: ({ path, force }: { path?: string, force?: boolean } = {}): void => {
      const target = path ?? 'current'
      const swallowed = lastReload?.path === target && lastReload.expires > Date.now()

      if (swallowed && !force) {
        calls.push(`reload avalé ${target}`)
        return
      }

      lastReload = { path: target, expires: Date.now() + RELOAD_GUARD_MS }
      calls.push(`reload ${target}`)
      reloads.push(target)
    },
    useRequestHeaders: () => ({}),
    getCurrentScope,
    onScopeDispose,
    watch,
    ref,
    computed,
    $fetch: vi.fn(async (url: string, options?: { method?: string, query?: Record<string, unknown> }) => {
      const query = options?.query
        ? `?${new URLSearchParams(Object.entries(options.query).map(([k, v]) => [k, String(v)]))}`
        : ''
      calls.push(`fetch ${options?.method ?? 'GET'} ${url}${query}`)
      if (fetchRejection) {
        throw fetchRejection
      }
      return fetchResponse
    }),
    navigateTo: (to: string): string => {
      navigations.push(to)
      calls.push(`navigate ${to}`)
      return to
    },
  })

  const signOut = (): void => {
    payloads.set(CURRENT_USER_KEY, { user: null, impersonator: null, testPlayers: [] } satisfies MeResponse)
  }

  return {
    serve: (key, payload) => payloads.set(key, payload),
    answerWith: (value) => {
      fetchResponse = value
    },
    breakRead: (key) => errors.set(key, new Error('lecture impossible')),
    breakNetwork: () => {
      fetchRejection = new Error('network unreachable')
    },
    signIn: user => payloads.set(
      CURRENT_USER_KEY,
      { user, impersonator: null, testPlayers: [] } satisfies MeResponse,
    ),
    impersonate: (admin, testPlayer) => payloads.set(
      CURRENT_USER_KEY,
      { user: testPlayer, impersonator: admin, testPlayers: [testPlayer] } satisfies MeResponse,
    ),
    signOut,
    cached: key => payloads.get(key) ?? null,
    calls: () => [...calls],
    navigations: () => [...navigations],
    reloads: () => [...reloads],
    refresh,
    reset: (): void => {
      payloads.clear()
      errors.clear()
      navigations.length = 0
      reloads.length = 0
      calls.length = 0
      // Remise à l'implémentation par défaut, et pas seulement au compteur
      // d'appels : un test qui pilote la relecture la laisserait sinon en place
      // pour tous les suivants du fichier.
      refresh.mockReset()
      refresh.mockImplementation(async () => {})
      fetchRejection = null
      fetchResponse = { ok: true }
      lastReload = null
      signOut()
    },
  }
}
