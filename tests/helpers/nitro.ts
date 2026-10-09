import {
  createApp,
  createError,
  createRouter,
  getQuery,
  getRequestHeader,
  getRequestHost,
  getRouterParam,
  defineEventHandler,
  getValidatedQuery,
  readValidatedBody,
  sendRedirect,
  toWebHandler,
  useSession,
} from 'h3'
import type { EventHandler } from 'h3'
import { getCurrentUser, getSessionUser, loginWithDiscord, requireAdmin, requireAuth, signIn, useAuthSession } from '../../server/utils/auth'
import { buildAuthorizeUrl, toDiscordProfile } from '../../server/utils/discord'
import type { DiscordProfile } from '../../server/utils/auth'

export const TEST_SESSION_PASSWORD = 'test-session-password-at-least-32-chars'

export interface DiscordStubs {
  exchangeCodeForToken: () => Promise<string>
  fetchDiscordProfile: () => Promise<DiscordProfile>
}

/**
 * Default stubs for a test that never goes near Discord: calling them is a bug in
 * the test, not a network round-trip.
 */
function refusingDiscordStubs(): DiscordStubs {
  const refuse = (): never => {
    throw new Error('Discord not stubbed in this test')
  }
  return { exchangeCodeForToken: refuse, fetchDiscordProfile: refuse }
}

/**
 * Nitro handlers rely on auto-imports, which don't exist under plain Vitest.
 * Install them on globalThis so a handler module can be imported and driven
 * directly, without booting a server or touching the network.
 */
export function installNitroGlobals(discord: DiscordStubs = refusingDiscordStubs()): void {
  Object.assign(globalThis, {
    defineEventHandler,
    getQuery,
    getRequestHeader,
    getRequestHost,
    getRouterParam,
    getValidatedQuery,
    readValidatedBody,
    createError,
    sendRedirect,
    useSession,
    useRuntimeConfig: () => ({
      sessionPassword: TEST_SESSION_PASSWORD,
      discord: {
        clientId: 'test-client',
        clientSecret: 'test-secret',
        redirectUri: 'http://test/api/auth/discord/callback',
      },
    }),
    useAuthSession,
    getCurrentUser,
    getSessionUser,
    requireAuth,
    requireAdmin,
    loginWithDiscord,
    signIn,
    buildAuthorizeUrl,
    toDiscordProfile,
    // Stubbed last so the network-facing pair never resolves to the real thing.
    ...discord,
  })
}

/** Wraps a single handler in an h3 app exposed as a standard fetch handler. */
export function mountHandler(
  path: string,
  handler: EventHandler,
): (request: Request) => Promise<Response> {
  const app = createApp()
  app.use(path, handler)
  return toWebHandler(app)
}

/**
 * Wraps a handler on a parameterised route (`/questions/:id`), so the handler can
 * read its route params the way Nitro's file-based routing gives them.
 */
export function mountRoute(
  method: 'get' | 'post' | 'put' | 'delete',
  path: string,
  handler: EventHandler,
): (request: Request) => Promise<Response> {
  const router = createRouter()
  router[method](path, handler)

  const app = createApp()
  app.use(router)

  return toWebHandler(app)
}

/** A GET on a mounted handler, signed in when a cookie is passed. */
export function apiRequest(url: string, cookie?: string): Request {
  return new Request(url, { headers: cookie ? { cookie } : {} })
}

/** A request carrying a JSON body, signed in when a cookie is passed. */
export function jsonRequest(
  url: string,
  method: 'POST' | 'PUT' | 'DELETE',
  body?: unknown,
  cookie?: string,
): Request {
  return new Request(url, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(cookie ? { cookie } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

/**
 * L'en-tête `set-cookie` entier d'une session qui s'ouvre, attributs compris.
 * Ce que renvoie un serveur ; `sessionCookieFor()` en garde ce qu'un navigateur
 * renverrait.
 */
export async function sessionSetCookieHeader(
  userId: number,
  actingAsUserId?: number,
): Promise<string> {
  const setSession = mountHandler('/session', defineEventHandler(async (event) => {
    const session = await useAuthSession(event)
    await session.update({ userId, actingAsUserId })
    return { ok: true }
  }))

  const response = await setSession(new Request('http://test/session'))

  return response.headers.get('set-cookie') ?? ''
}

/**
 * A session cookie for a signed-in player, without replaying the OAuth flow —
 * the flow itself is covered by callback.test.ts. La paire `nom=valeur` seule,
 * qui est ce qu'un navigateur renvoie.
 */
export async function sessionCookieFor(userId: number, actingAsUserId?: number): Promise<string> {
  return nameAndValue(await sessionSetCookieHeader(userId, actingAsUserId))
}

/** Ce qu'un navigateur renverrait d'un `set-cookie` : la paire, sans les attributs. */
function nameAndValue(setCookie: string): string {
  return setCookie.split(';')[0]
}
