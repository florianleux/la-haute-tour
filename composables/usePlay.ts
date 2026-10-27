import { GAME_STATE_KEY } from './useGameState'
import { prefersReducedMotion, wait } from '../utils/motion'
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
  /** « Entrer » : ouvrir le combat de boss, au terme de la porte et de l'introduction. */
  enterBoss: () => Promise<void>
  /** True when the last action came back empty-handed. */
  failed: Ref<boolean>
  pending: Ref<boolean>
}

/**
 * Ce que dure au moins l'attente du jugement d'une réponse : l'animation de Valider va à
 * son terme avant le verdict, même quand le serveur répond plus vite. La
 * durée de `animate-ink-lift` et du début de `animate-judge-quiver`
 * (assets/css/main.css) : elles bougent ensemble. Voir specs/ecrans.md.
 */
export const JUDGING_MS = 300

/**
 * The player's moves. Each action answers with the new game state, which replaces
 * the cached read — the client never computes a phase, a life or a deadline of its
 * own. See specs/architecture.md.
 */
export function usePlay(): Play {
  const nuxtApp = useNuxtApp()
  const { data } = useNuxtData<GameState>(GAME_STATE_KEY)

  // L'état rendu se pose dans la lecture partagée et dans le payload : Nuxt ne
  // recopie dans le payload que ce qu'il lit lui-même, et c'est le payload que
  // relit chaque nouvel appel à useGameState() (son getCachedData). Sans la
  // copie, une page montée après un coup repartait de la dernière lecture —
  // une chute déjà lue y repassait, et se rouvrait.
  const view = computed<GameState | null>({
    get: () => data.value,
    set: (state) => {
      data.value = state
      nuxtApp.payload.data[GAME_STATE_KEY] = state
    },
  })
  const { pending, failed, send } = useWriteThenReplace(view)

  /**
   * Un coup du joueur : le serveur rend l'état d'après, la page l'affiche —
   * pas avant `hold` ms, le temps que l'animation du geste aille à son terme.
   */
  async function move(url: string, body?: Record<string, string>, hold = 0): Promise<void> {
    await send(async () => {
      const [state] = await Promise.all([
        $fetch<GameState>(url, { method: 'POST', body }),
        hold > 0 ? wait(hold) : undefined,
      ])
      return state
    })
  }

  // Seule Valider attend : sur Suivante, chaque instant d'animation serait pris
  // au chrono de la question, qui court déjà côté serveur. Sous « réduire les
  // animations », rien à attendre — `motion-safe:` a retiré l'animation.
  const judgingHold = (): number => (prefersReducedMotion() ? 0 : JUDGING_MS)

  return {
    next: () => move('/api/game/next'),
    answer: (text, source = 'player') => move('/api/game/answer', { answer: text, source }, judgingHold()),
    skipCooldown: () => move('/api/game/skip-cooldown'),
    openChest: () => move('/api/game/chest'),
    enterBoss: () => move('/api/game/boss'),
    failed,
    pending,
  }
}
