import type { ComputedRef, Ref } from 'vue'
import type { PlayerCard } from '~~/server/utils/players'

export interface PlayerCooldown {
  /** Le joueur attend : c'est ce qui rend « passer l'attente » possible. */
  inCooldown: ComputedRef<boolean>
  /** Le délai restant, tel qu'on le lit. Null hors attente. */
  remaining: ComputedRef<string | null>
}

/**
 * L'attente d'un joueur, dite une fois pour la ligne du tableau et la fiche
 * d'un joueur test. Null : un invité pas encore venu, qui n'attend rien.
 * « Terminée » plutôt qu'un délai quand l'échéance vient de passer : la phase
 * du serveur ne bougera qu'à la prochaine lecture du joueur.
 */
export function usePlayerCooldown(player: Ref<PlayerCard | null>, now: Ref<number>): PlayerCooldown {
  return {
    inCooldown: computed(() => player.value?.phase === 'cooldown'),
    remaining: computed(() =>
      (player.value?.cooldownUntil ? formatCooldownMinutes(player.value.cooldownUntil, now.value) : null),
    ),
  }
}
