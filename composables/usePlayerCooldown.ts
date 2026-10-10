import type { ComputedRef, Ref } from 'vue'
import type { PlayerCard } from '~~/server/utils/players'

export interface PlayerCooldown {
  /** Le joueur attend : c'est ce qui rend « passer l'attente » possible. */
  inCooldown: ComputedRef<boolean>
  /** Le délai restant, tel qu'on le lit. Null hors attente. */
  remaining: ComputedRef<string | null>
}

/**
 * L'attente d'une fiche joueur, dite une fois pour les deux fiches qui la
 * portent. « Terminée » plutôt qu'un délai quand l'échéance vient de passer :
 * la phase du serveur ne bougera qu'à la prochaine lecture du joueur.
 */
export function usePlayerCooldown(player: Ref<PlayerCard>, now: Ref<number>): PlayerCooldown {
  return {
    inCooldown: computed(() => player.value.phase === 'cooldown'),
    remaining: computed(() =>
      (player.value.cooldownUntil ? formatCooldown(player.value.cooldownUntil, now.value) : null),
    ),
  }
}
