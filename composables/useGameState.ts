import type { Ref } from 'vue'
import type { GameState } from '~~/server/utils/game'

/** Cache key of the game state read: one name, so nobody re-types the string. */
export const GAME_STATE_KEY = 'game-state'

export interface GameStateRead {
  state: Ref<GameState | null>
  /** True when the server said nothing usable: the page shows it, never invents it. */
  failed: Ref<boolean>
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
  const { data, error, refresh } = await useAsyncData<GameState | null>(
    GAME_STATE_KEY,
    () => $fetch<GameState>('/api/game/state', useApiFetchOptions()),
    { default: (): GameState | null => null },
  )

  return {
    state: data,
    failed: computed<boolean>(() => Boolean(error.value)),
    refresh,
  }
}
