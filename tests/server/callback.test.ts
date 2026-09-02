import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setDatabase } from '../../server/db/client'
import { users, whitelist } from '../../server/db/schema'
import { createTestDatabase } from '../helpers/db'
import { installNitroGlobals, mountHandler } from '../helpers/nitro'
import type { Database } from '../../server/db/client'
import type { DiscordProfile } from '../../server/utils/auth'

const DISCORD_ID = '123456789'

const profile: DiscordProfile = {
  discordId: DISCORD_ID,
  username: 'gandalf',
  email: 'gandalf@example.com',
}

const fetchDiscordProfile = vi.fn(async () => profile)

installNitroGlobals({
  exchangeCodeForToken: async () => 'access-token',
  fetchDiscordProfile,
})

const { default: callbackHandler } = await import('../../server/api/auth/discord/callback.get')
const { default: startHandler } = await import('../../server/api/auth/discord/index.get')

const callback = mountHandler('/callback', callbackHandler)
const start = mountHandler('/start', startHandler)

/** Runs the real /api/auth/discord handler to get a session cookie holding a state. */
async function startOAuth(): Promise<{ cookie: string, state: string }> {
  const response = await start(new Request('http://test/start'))
  const location = response.headers.get('location') ?? ''
  return {
    cookie: (response.headers.get('set-cookie') ?? '').split(';')[0],
    state: new URL(location).searchParams.get('state') ?? '',
  }
}

function callbackRequest(query: string, cookie?: string): Request {
  return new Request(`http://test/callback?${query}`, {
    headers: cookie ? { cookie } : {},
  })
}

describe('callback OAuth Discord', () => {
  let db: Database

  beforeEach(async () => {
    db = await createTestDatabase()
    setDatabase(db)
    fetchDiscordProfile.mockResolvedValue(profile)
  })

  it('renvoie sur /login quand le joueur annule chez Discord', async () => {
    const response = await callback(callbackRequest('error=access_denied&state=abc'))

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('/login')
  })

  it('rejette un callback sans code ni state', async () => {
    const response = await callback(callbackRequest(''))

    expect(response.status).toBe(400)
  })

  it('rejette un state qui ne correspond pas à la session', async () => {
    const { cookie } = await startOAuth()

    const response = await callback(callbackRequest('code=abc&state=pas-le-bon', cookie))

    expect(response.status).toBe(400)
  })

  it('renvoie sur /refus sans créer de compte si le Discord ID n est pas whitelisté', async () => {
    const { cookie, state } = await startOAuth()

    const response = await callback(callbackRequest(`code=abc&state=${state}`, cookie))

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('/refus')
    expect(await db.select().from(users)).toHaveLength(0)
  })

  it('crée le joueur et pose la session si le Discord ID est whitelisté', async () => {
    await db.insert(whitelist).values({ discordId: DISCORD_ID })
    const { cookie, state } = await startOAuth()

    const response = await callback(callbackRequest(`code=abc&state=${state}`, cookie))

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('/')
    expect(response.headers.get('set-cookie')).toContain('lht_session=')

    const [user] = await db.select().from(users)
    expect(user).toMatchObject({
      discordId: DISCORD_ID,
      username: 'gandalf',
      currentFloor: 1,
      lives: 3,
      isAdmin: false,
    })
  })
})
