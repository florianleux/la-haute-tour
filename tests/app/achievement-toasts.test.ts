import { beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { installAppGlobals } from '../helpers/app'

const { serve, reset } = installAppGlobals()

const { GAME_STATE_KEY } = await import('../../composables/useGameState')
const { useAchievementToasts } = await import('../../composables/useAchievementToasts')

/** L'état de jeu tel qu'une écriture vient de le poser dans le cache. */
function landed(unlocked: string[]): void {
  serve(GAME_STATE_KEY, { phase: 'ascent', unlocked })
}

describe('les annonces de succès', () => {
  beforeEach(reset)

  it('n annonce rien tant que rien n est débloqué', async () => {
    landed([])

    const { toasts } = useAchievementToasts()
    await nextTick()

    expect(toasts.value).toEqual([])
  })

  it('annonce ce qu une écriture vient de graver', async () => {
    const { toasts } = useAchievementToasts()

    landed(['FIRST_CORRECT'])
    await nextTick()

    expect(toasts.value.map(toast => toast.id)).toEqual(['FIRST_CORRECT'])
  })

  it('empile plusieurs déblocages arrivés ensemble', async () => {
    const { toasts } = useAchievementToasts()

    landed(['GAME_COMPLETED', 'FLAWLESS_FLOOR_6'])
    await nextTick()

    expect(toasts.value.map(toast => toast.id)).toEqual(['GAME_COMPLETED', 'FLAWLESS_FLOOR_6'])
  })

  /**
   * La propriété qui tient tout le mécanisme : le serveur ne met dans `unlocked`
   * que ce qu une requête a réellement écrit, donc une relecture rend un tableau
   * vide et n annonce rien. Rien à dédupliquer côté client.
   */
  it('ne rejoue pas une annonce à la relecture', async () => {
    const { toasts } = useAchievementToasts()

    landed(['FIRST_CORRECT'])
    await nextTick()

    landed([])
    await nextTick()

    expect(toasts.value.map(toast => toast.id)).toEqual(['FIRST_CORRECT'])
  })

  it('laisse fermer une annonce à la main', async () => {
    const { toasts, dismiss } = useAchievementToasts()

    landed(['FIRST_WRONG'])
    await nextTick()

    dismiss(toasts.value[0].key)

    expect(toasts.value).toEqual([])
  })
})
