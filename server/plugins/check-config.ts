import { resolveDatabaseUrl } from '../db/client'

/** The value shipped in `.env.example` — must never reach a running server. */
const SESSION_PASSWORD_PLACEHOLDER = 'change-me-with-at-least-32-characters'

/**
 * Fail at startup rather than on the first login: a missing env var otherwise
 * surfaces as an opaque error in the middle of the OAuth flow.
 */
export default defineNitroPlugin(() => {
  const { sessionPassword, discord } = useRuntimeConfig()

  // Long enough to pass the length check, yet public: sealed session cookies
  // would be forgeable, which defeats the whitelist entirely.
  if (sessionPassword === SESSION_PASSWORD_PLACEHOLDER) {
    throw new Error(
      'NUXT_SESSION_PASSWORD est encore la valeur d\'exemple de .env.example — '
      + 'génère un secret (openssl rand -hex 32)',
    )
  }

  const missing = [
    sessionPassword.length >= 32 ? null : 'NUXT_SESSION_PASSWORD (>= 32 caractères)',
    discord.clientId ? null : 'NUXT_DISCORD_CLIENT_ID',
    discord.clientSecret ? null : 'NUXT_DISCORD_CLIENT_SECRET',
    discord.redirectUri ? null : 'NUXT_DISCORD_REDIRECT_URI',
    resolveDatabaseUrl() ? null : 'DATABASE_URL',
  ].filter((v): v is string => v !== null)

  if (missing.length > 0) {
    throw new Error(`Configuration manquante : ${missing.join(', ')}`)
  }
})
