import { beforeEach, describe, expect, it } from 'vitest'
import { installAppGlobals, testUser } from '../helpers/app'

const { navigations, calls, reset, signIn, breakFetch } = installAppGlobals()

const { useLogout } = await import('../../composables/useLogout')
const { useCurrentUser } = await import('../../composables/useCurrentUser')

describe('déconnexion', () => {
  beforeEach(() => {
    reset()
    signIn(testUser)
  })

  it('ferme la session, vide les lectures en cache, puis ramène à la connexion', async () => {
    const { logout, failed } = useLogout()

    await logout()

    // L'ordre porte la règle : vider le cache après avoir navigué laisserait
    // /login relire un joueur en cache et le renvoyer sur l'accueil.
    expect(calls).toEqual([
      'fetch POST /api/auth/logout',
      'clear cache',
      'navigate /login',
    ])
    expect(failed.value).toBe(false)
  })

  it('ne laisse derrière lui aucune lecture du joueur parti', async () => {
    const { logout } = useLogout()

    await logout()

    const { user } = await useCurrentUser()
    expect(user.value).toBeNull()
  })

  it('marque le bouton occupé le temps de la déconnexion', async () => {
    const { logout, pending } = useLogout()

    const inFlight = logout()
    expect(pending.value).toBe(true)
    await inFlight

    expect(pending.value).toBe(false)
  })

  it('reste sur place et le dit quand le serveur refuse', async () => {
    breakFetch()
    const { logout, failed } = useLogout()

    await logout()

    expect(failed.value).toBe(true)
    expect(navigations).toEqual([])
    expect(calls).toEqual(['fetch POST /api/auth/logout'])
  })
})
