import { GAME_STATE_KEY } from './useGameState'
import { useWriteThenReplace } from './useWriteThenReplace'
import type { Ref } from 'vue'
import type { AnswerSource } from '~~/server/utils/mechanics'
import type { GameState } from '~~/server/utils/game'

export interface Play {
  /** Start, or move on to the next question. The only thing that reserves one. */
  next: () => Promise<void>
  /**
   * Submit an answer. An empty one is a legitimate, wrong, answer.
   * `source` dit qui l'envoie : le joueur, ou son départ de la page.
   */
  answer: (text: string, source?: AnswerSource) => Promise<void>
  /** L'admin passe sa propre attente. Sans effet pour un joueur non admin. */
  skipCooldown: () => Promise<void>
  /** Ouvrir le coffre d'une question loot réussie. Le dé se jette côté serveur. */
  openChest: () => Promise<void>
  /** True when the last action came back empty-handed. */
  failed: Ref<boolean>
  pending: Ref<boolean>
}

/**
 * The player's moves. Each action answers with the new game state, which replaces
 * the cached read — the client never computes a phase, a life or a deadline of its
 * own. See specs/architecture.md.
 */
export function usePlay(): Play {
  const { data } = useNuxtData<GameState>(GAME_STATE_KEY)
  const { pending, failed, send } = useWriteThenReplace(data)

  /** Un coup du joueur : le serveur rend l'état d'après, la page l'affiche. */
  async function move(url: string, body?: Record<string, string>): Promise<void> {
    await send(() => $fetch<GameState>(url, { method: 'POST', body }))
  }

  return {
    next: () => move('/api/game/next'),
    answer: (text, source = 'player') => move('/api/game/answer', { answer: text, source }),
    skipCooldown: () => move('/api/game/skip-cooldown'),
    openChest: () => move('/api/game/chest'),
    failed,
    pending,
  }
}
