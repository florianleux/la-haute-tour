import {
  createApp,
  createError,
  getQuery,
  defineEventHandler,
  sendRedirect,
  toWebHandler,
  useSession,
} from 'h3'
import type { EventHandler } from 'h3'
import { getCurrentUser, loginWithDiscord, requireAdmin, requireAuth, useAuthSession } from '../../server/utils/auth'
import { buildAuthorizeUrl, toDiscordProfile } from '../../server/utils/discord'
import type { DiscordProfile } from '../../server/utils/auth'

export const TEST_SESSION_PASSWORD = 'test-session-password-at-least-32-chars'

export interface DiscordStubs {
  exchangeCodeForToken: () => Promise<string>
  fetchDiscordProfile: () => Promise<DiscordProfile>
}

/**
 * Nitro handlers rely on auto-imports, which don't exist under plain Vitest.
 * Install them on globalThis so a handler module can be imported and driven
 * directly, without booting a server or touching the network.
 */
export function installNitroGlobals(discord: DiscordStubs): void {
  Object.assign(globalThis, {
    defineEventHandler,
    getQuery,
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
    requireAuth,
    requireAdmin,
    loginWithDiscord,
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
