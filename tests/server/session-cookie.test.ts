import { describe, expect, it } from 'vitest'
import { installNitroGlobals, mountHandler, sessionCookieFor, sessionSetCookieHeader } from '../helpers/nitro'

installNitroGlobals()

const { default: logoutHandler } = await import('../../server/api/auth/logout.post')

const logout = mountHandler('/logout', logoutHandler)

/**
 * Les attributs que le cookie de session emporte. Ce qu'ils valent, et pourquoi :
 * specs/architecture.md#authentification.
 *
 * Ce que ces tests ne peuvent pas : `SameSite` est appliqué par le navigateur et
 * par personne d'autre, donc aucun test d'ici ne rejoue une requête cross-site.
 * Ce qui se verrouille est la **valeur** de l'attribut — et c'est bien elle qui
 * compte, `strict` fermant la porte au lieu de mieux la garder.
 */
describe('cookie de session', () => {
  it('part en SameSite=Lax', async () => {
    expect(await sessionSetCookieHeader(1)).toContain('SameSite=Lax')
  })

  it('garde Secure, HttpOnly et Path=/', async () => {
    const header = await sessionSetCookieHeader(1)

    expect(header).toContain('lht_session=')
    expect(header).toContain('Secure')
    expect(header).toContain('HttpOnly')
    expect(header).toContain('Path=/')
  })

  it('emporte les mêmes attributs quand le logout le vide', async () => {
    const cookie = await sessionCookieFor(1)

    const response = await logout(new Request('http://test/logout', {
      method: 'POST',
      headers: { cookie },
    }))
    const cleared = response.headers.get('set-cookie') ?? ''

    expect(cleared).toContain('SameSite=Lax')
    expect(cleared).toContain('Secure')
    expect(cleared).toContain('HttpOnly')
  })
})
