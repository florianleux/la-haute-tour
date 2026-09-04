import { GAME_STATE_KEY } from './useGameState'
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
  const failed = ref(false)
  const pending = ref(false)

  async function act(url: string, body?: Record<string, string>): Promise<void> {
    pending.value = true
    failed.value = false

    try {
      data.value = await $fetch<GameState>(url, { method: 'POST', body })
    }
    catch {
      failed.value = true
    }
    finally {
      pending.value = false
    }
  }

  return {
    next: () => act('/api/game/next'),
    answer: (text, source = 'player') => act('/api/game/answer', { answer: text, source }),
    skipCooldown: () => act('/api/game/skip-cooldown'),
    failed,
    pending,
  }
}
