import { beforeEach, describe, expect, it } from 'vitest'
import { installAppGlobals, testUser } from '../helpers/app'

const { navigations, calls, reset, signIn, breakFetch } = installAppGlobals()

const { useLogout } = await import('../../composables/useLogout')

describe('déconnexion', () => {
  beforeEach(() => {
    reset()
    signIn(testUser)
  })

  it('ferme la session, vide les lectures en cache, puis ramène à la connexion', async () => {
    const { logout, failed } = useLogout()

    await logout()

    // L'ordre porte la règle : rafraîchir après avoir navigué laisserait /login
    // relire un joueur en cache et le renvoyer sur l'accueil.
    expect(calls).toEqual([
      'fetch /api/auth/logout',
      'refresh current-user,game-state',
      'navigate /login',
    ])
    expect(failed.value).toBe(false)
  })

  it('reste sur place et le dit quand le serveur refuse', async () => {
    breakFetch()
    const { logout, failed } = useLogout()

    await logout()

    expect(failed.value).toBe(true)
    expect(navigations).toEqual([])
    expect(calls).toEqual(['fetch /api/auth/logout'])
  })
})
