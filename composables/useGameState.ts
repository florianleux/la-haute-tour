import type { ComputedRef, InjectionKey, MaybeRefOrGetter, Ref } from 'vue'
import type { GameState } from '~~/server/utils/game'

/** Cache key of the game state read: one name, so nobody re-types the string. */
export const GAME_STATE_KEY = 'game-state'

export interface GameStateRead {
  state: Ref<GameState | null>
  /** True when the server said nothing usable: the page shows it, never invents it. */
  failed: Ref<boolean>
  /** True while the state is being read back. */
  loading: Ref<boolean>
  refresh: () => Promise<void>
}

/**
 * Where the player stands — phase, floor, lives, and what the phase carries. Never
 * kept client-side: the page redisplays what the server returns.
 *
 * For protected pages only: the auth middleware has already turned away anonymous
 * visitors. Reading has no effect on the game.
 */
export async function useGameState(): Promise<GameStateRead> {
  const { data, error, status, refresh } = await useAsyncData<GameState | null>(
    GAME_STATE_KEY,
    () => $fetch<GameState>('/api/game/state', useApiFetchOptions()),
    {
      default: (): GameState | null => null,
      // Sur navigation client, l'état est déjà en cache — la page se lit
      // instantanément, sans re-demander l'état au serveur.
      //
      // L'état vivant d'abord, le payload ensuite : chaque coup du joueur pose
      // l'état rendu par le serveur dans la lecture partagée (usePlay), pas dans
      // le payload, qui reste sur la dernière lecture GET. Repris seul à chaque
      // nouvel appel — le middleware du camp en fait un à chaque ouverture du
      // Volumen ou du Grimoire —, il ramenait la partie à cet état périmé le
      // temps de la relecture : la chute déjà lue y repassait et se rouvrait
      // sous la boîte.
      getCachedData: (_key, nuxtApp) =>
        (nuxtApp._asyncData[GAME_STATE_KEY]?.data.value ?? nuxtApp.payload.data[GAME_STATE_KEY]) as GameState | null | undefined,
    },
  )

  return {
    state: data,
    failed: computed<boolean>(() => Boolean(error.value)),
    loading: computed<boolean>(() => status.value === 'pending'),
    refresh,
  }
}

const SHOWN_STATE: InjectionKey<ComputedRef<GameState | null>> = Symbol('shown-game-state')

/**
 * L'état que la page affiche, offert aux composants qui en lisent un détail
 * loin d'elle — l'infobulle d'un sort compte les vies et l'échéance de
 * l'attente. Sans ça, l'état entier traverserait chaque liste qui montre un
 * effet. Les pages de test l'appellent avec leur faux état.
 */
export function provideGameState(state: MaybeRefOrGetter<GameState | null>): void {
  provide(SHOWN_STATE, computed(() => toValue(state)))
}

/** L'état que la page a offert ; null hors d'une page qui en offre un. */
export function useShownGameState(): ComputedRef<GameState | null> {
  return inject(SHOWN_STATE, computed(() => null))
}
