import type { Ref } from 'vue'
import type { GameStateResponse } from '~~/server/api/game/state.get'

/** Cache key of the game state read: one name, so nobody re-types the string. */
export const GAME_STATE_KEY = 'game-state'

export interface GameState {
  state: Ref<GameStateResponse | null>
  /** True when the server said nothing usable: the page shows it, never invents it. */
  failed: Ref<boolean>
  refresh: () => Promise<void>
}

/**
 * Where the player stands — floor and lives, and later the phase. Never kept
 * client-side: the page redisplays what the server returns.
 *
 * For protected pages only: the auth middleware has already turned away anonymous
 * visitors. Reading has no effect on the game.
 */
export async function useGameState(): Promise<GameState> {
  const { data, error, refresh } = await useAsyncData<GameStateResponse | null>(
    GAME_STATE_KEY,
    () => $fetch<GameStateResponse>('/api/game/state', useApiFetchOptions()),
    { default: (): GameStateResponse | null => null },
  )

  return {
    state: data,
    failed: computed<boolean>(() => Boolean(error.value)),
    refresh,
  }
}
