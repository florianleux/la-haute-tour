import { beforeEach, describe, expect, it } from 'vitest'
import { useImpersonation } from '../../composables/useImpersonation'
import { installAppGlobals } from '../helpers/app'

const { calls, reloads, breakNetwork, reset } = installAppGlobals()

describe('bascule d incarnation', () => {
  beforeEach(reset)

  it('incarne un joueur test, puis redémarre l application sur le jeu', async () => {
    const { actAs, failed } = useImpersonation()

    await actAs(2)

    expect(calls()).toEqual([
      'fetch POST /api/admin/impersonate',
      'reload /',
    ])
    expect(failed.value).toBe(false)
  })

  it('redevient soi-même avec null', async () => {
    const { actAs } = useImpersonation()

    await actAs(null)

    expect(calls()).toContain('fetch POST /api/admin/impersonate')
    expect(reloads()).toEqual(['/'])
  })

  it('recharge plutôt que de naviguer : depuis le jeu, aller au jeu ne ferait rien', async () => {
    // C'est tout le bug : `navigateTo('/')` depuis `/` n'est pas un événement,
    // et les caches vidés ne se relisent pas tout seuls — l'écran restait vide.
    const { actAs } = useImpersonation()

    await actAs(2)

    expect(reloads()).toEqual(['/'])
  })

  // Le bug : incarner puis revenir à soi, c'est deux fois `/`. Nuxt avale le
  // second rechargement vers le même chemin dans les dix secondes — garde-fou
  // anti-boucle — et la page restait sur la partie de l'autre, sélecteur grisé.
  it('recharge à chaque bascule, y compris la seconde dans la foulée', async () => {
    const { actAs } = useImpersonation()

    await actAs(2)
    await actAs(null)

    expect(reloads()).toEqual(['/', '/'])
    expect(calls()).not.toContain('reload avalé /')
  })

  it('ne recharge rien quand le serveur refuse, et le dit', async () => {
    breakNetwork()
    const { actAs, failed, pending } = useImpersonation()

    await actAs(2)

    expect(reloads()).toEqual([])
    expect(failed.value).toBe(true)
    expect(pending.value).toBe(false)
  })

  it('reste occupé jusqu au départ de la page, pour ne pas rejouer la bascule', async () => {
    const { actAs, pending } = useImpersonation()

    await actAs(2)

    expect(pending.value).toBe(true)
  })
})
