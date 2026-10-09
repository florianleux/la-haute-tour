import { describe, expect, it } from 'vitest'
import { installNitroGlobals, mountHandler } from '../helpers/nitro'

installNitroGlobals()

const { default: devLoginHandler } = await import('../../server/api/auth/dev.get')

const devLogin = mountHandler('/dev', devLoginHandler)

/**
 * La connexion locale n'existe qu'en développement : hors `nuxt dev`,
 * `import.meta.dev` est faux et le handler ne connecte personne. Vitest tourne
 * hors dev, comme un build de production.
 */
describe('connexion locale', () => {
  it('répond 404 hors développement, sans poser de session', async () => {
    const response = await devLogin(new Request('http://test/dev'))

    expect(response.status).toBe(404)
    expect(response.headers.get('set-cookie')).toBeNull()
  })
})
