import { z } from 'zod'
import type { DiscordProfile } from './auth'

const AUTHORIZE_URL = 'https://discord.com/oauth2/authorize'
const TOKEN_URL = 'https://discord.com/api/oauth2/token'
const USER_URL = 'https://discord.com/api/users/@me'

export interface OAuthParams {
  clientId: string
  redirectUri: string
  state: string
}

export function buildAuthorizeUrl({ clientId, redirectUri, state }: OAuthParams): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'identify email',
    state,
  })
  return `${AUTHORIZE_URL}?${params}`
}

const tokenResponseSchema = z.object({ access_token: z.string() })

/** Réponse Discord : validée au runtime, on est à la frontière réseau. */
const discordUserSchema = z.object({
  id: z.string(),
  username: z.string(),
  email: z.string().nullish(),
  avatar: z.string().nullish(),
})

export function toDiscordProfile(raw: unknown): DiscordProfile {
  const user = discordUserSchema.parse(raw)
  return {
    discordId: user.id,
    username: user.username,
    email: user.email ?? null,
    avatar: user.avatar ?? null,
  }
}

export async function exchangeCodeForToken(options: {
  code: string
  clientId: string
  clientSecret: string
  redirectUri: string
}): Promise<string> {
  const response = await $fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: options.clientId,
      client_secret: options.clientSecret,
      grant_type: 'authorization_code',
      code: options.code,
      redirect_uri: options.redirectUri,
    }).toString(),
  })

  return tokenResponseSchema.parse(response).access_token
}

export async function fetchDiscordProfile(accessToken: string): Promise<DiscordProfile> {
  const response = await $fetch(USER_URL, {
    headers: { authorization: `Bearer ${accessToken}` },
  })

  return toDiscordProfile(response)
}
