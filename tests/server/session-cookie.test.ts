import { defineEventHandler } from 'h3'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useAuthSession } from '../../server/utils/auth'
import { installNitroGlobals, mountHandler, sessionCookieFor, sessionSetCookieHeader } from '../helpers/nitro'

installNitroGlobals()

const { default: logoutHandler } = await import('../../server/api/auth/logout.post')

const logout = mountHandler('/logout', logoutHandler)

/** Qui la session désigne, sans passer par la base : le sceau suffit à le dire. */
const whoami = mountHandler('/whoami', defineEventHandler(async (event) => {
  const session = await useAuthSession(event)

  return { userId: session.data.userId ?? null }
}))

async function signedInAs(cookie: string): Promise<number | null> {
  const response = await whoami(new Request('http://test/whoami', { headers: { cookie } }))

  return (await response.json() as { userId: number | null }).userId
}

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

/**
 * Le cookie porte son échéance, mais c'est le navigateur qui la respecte : une
 * valeur recopiée ailleurs n'a plus personne pour l'oublier. C'est donc au
 * descellement que l'année se vérifie.
 */
describe('durée de vie de la session', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('désigne encore son joueur avant l\'échéance', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
    const cookie = await sessionCookieFor(7)

    vi.setSystemTime(new Date('2026-12-31T00:00:00Z'))

    expect(await signedInAs(cookie)).toBe(7)
  })

  it('n\'ouvre plus rien passé un an', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
    const cookie = await sessionCookieFor(7)

    vi.setSystemTime(new Date('2027-01-02T00:00:00Z'))

    expect(await signedInAs(cookie)).toBeNull()
  })
})
