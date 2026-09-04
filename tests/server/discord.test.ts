import { describe, expect, it } from 'vitest'
import { buildAuthorizeUrl, toDiscordProfile } from '../../server/utils/discord'

describe('buildAuthorizeUrl', () => {
  it('construit l URL d autorisation Discord avec les scopes identify et email', () => {
    const url = new URL(buildAuthorizeUrl({
      clientId: 'client-42',
      redirectUri: 'http://localhost:3000/api/auth/discord/callback',
      state: 'state-token',
    }))

    expect(url.origin + url.pathname).toBe('https://discord.com/oauth2/authorize')
    expect(url.searchParams.get('client_id')).toBe('client-42')
    expect(url.searchParams.get('response_type')).toBe('code')
    expect(url.searchParams.get('scope')).toBe('identify email')
    expect(url.searchParams.get('state')).toBe('state-token')
    expect(url.searchParams.get('redirect_uri'))
      .toBe('http://localhost:3000/api/auth/discord/callback')
  })
})

describe('toDiscordProfile', () => {
  it('mappe la réponse Discord sur un profil', () => {
    const profile = toDiscordProfile({
      id: '123456789',
      username: 'gandalf',
      email: 'gandalf@example.com',
      avatar: 'a1b2c3',
      global_name: 'Gandalf le Gris',
    })

    expect(profile).toEqual({
      discordId: '123456789',
      username: 'gandalf',
      email: 'gandalf@example.com',
      avatar: 'a1b2c3',
    })
  })

  it('accepte un compte sans email', () => {
    const profile = toDiscordProfile({ id: '1', username: 'radagast', email: null })

    expect(profile.email).toBeNull()
  })

  it('accepte un compte sans avatar', () => {
    const profile = toDiscordProfile({ id: '1', username: 'radagast', avatar: null })

    expect(profile.avatar).toBeNull()
  })

  it('rejette une réponse Discord malformée', () => {
    expect(() => toDiscordProfile({ id: 42 })).toThrow()
  })
})
