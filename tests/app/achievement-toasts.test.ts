import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick } from 'vue'
import type { EffectScope } from 'vue'
import { installAppGlobals } from '../helpers/app'

const { serve, reset } = installAppGlobals()

const { GAME_STATE_KEY } = await import('../../composables/useGameState')
const { TOAST_MS, useAchievementAnnouncer, useAchievementToasts } = await import('../../composables/useAchievementToasts')

/** L'état de jeu tel qu'une écriture vient de le poser dans le cache. */
function landed(unlocked: string[]): void {
  serve(GAME_STATE_KEY, { phase: 'ascent', unlocked })
}

describe('les annonces de succès', () => {
  // Le délai d'expiration est la mécanique testée ici : chaque test avance
  // l'horloge lui-même plutôt que d'attendre le délai réel.
  beforeEach(() => {
    reset()
    vi.useFakeTimers()
    scope = effectScope()
  })

  afterEach(() => {
    scope.stop()
    vi.useRealTimers()
  })

  // La file est partagée (useState) : l'observateur d'un test précédent, resté
  // vivant, y annoncerait encore. Chaque test monte le sien dans sa portée.
  let scope: EffectScope

  function toastsInScope(): ReturnType<typeof useAchievementToasts> {
    return scope.run(() => useAchievementToasts())!
  }

  // Le don du Fromage ne rend pas d'état de jeu : il annonce lui-même ce qu'il a
  // gravé. Voir components/InventoryOverlay.vue.
  it('annonce un succès posé directement, sans état de jeu', () => {
    const toasts = toastsInScope()

    scope.run(() => useAchievementAnnouncer())!(['CHEESE_GIVEN'])

    expect(toasts.value.map(toast => toast.id)).toEqual(['CHEESE_GIVEN'])
  })

  it('n annonce rien tant que rien n est débloqué', async () => {
    landed([])

    const toasts = toastsInScope()
    await nextTick()

    expect(toasts.value).toEqual([])
  })

  it('annonce ce qu une écriture vient de graver', async () => {
    const toasts = toastsInScope()

    landed(['FIRST_CORRECT'])
    await nextTick()

    expect(toasts.value.map(toast => toast.id)).toEqual(['FIRST_CORRECT'])
  })

  it('empile plusieurs déblocages arrivés ensemble', async () => {
    const toasts = toastsInScope()

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
    const toasts = toastsInScope()

    landed(['FIRST_CORRECT'])
    await nextTick()

    landed([])
    await nextTick()

    expect(toasts.value.map(toast => toast.id)).toEqual(['FIRST_CORRECT'])
  })

  /**
   * L'Assiduité se gagne hors jeu et se découvre sur la page — jamais en toast,
   * même quand le serveur l'a bien mise dans `unlocked`. Voir specs/succes.md#affichage.
   */
  it('tait l Assiduité, même arrivée avec d autres déblocages', async () => {
    const toasts = toastsInScope()

    landed(['FIRST_CORRECT', 'DAYS_7', 'TWO_DAYS_IN_A_ROW'])
    await nextTick()

    expect(toasts.value.map(toast => toast.id)).toEqual(['FIRST_CORRECT'])
  })

  /**
   * La seule sortie d'une annonce est le temps : rien dans l'écran ne la ferme,
   * et le joueur n'a donc aucun geste à faire pour revenir à sa partie.
   */
  it('disparaît seule au bout de son délai', async () => {
    const toasts = toastsInScope()

    landed(['FIRST_WRONG'])
    await nextTick()
    expect(toasts.value).toHaveLength(1)

    vi.advanceTimersByTime(TOAST_MS)

    expect(toasts.value).toEqual([])
  })

  it('laisse chaque annonce vivre son propre délai', async () => {
    const toasts = toastsInScope()

    landed(['FIRST_CORRECT'])
    await nextTick()

    vi.advanceTimersByTime(TOAST_MS / 2)
    landed(['FIRST_WRONG'])
    await nextTick()

    // La première expire ; la seconde, arrivée à mi-course, tient encore.
    vi.advanceTimersByTime(TOAST_MS / 2)

    expect(toasts.value.map(toast => toast.id)).toEqual(['FIRST_WRONG'])
  })
})
