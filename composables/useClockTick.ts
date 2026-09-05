import type { Ref } from 'vue'

/**
 * Combien de temps entre deux battements. Les délais s'affichent à la minute :
 * une demi-minute suffit à ce qu'aucun chiffre affiché ne soit faux.
 */
const TICK_MS = 30_000

/**
 * L'horloge d'une liste, pour que les délais restants descendent tout seuls.
 * Écrite une fois : deux listes qui la recopieraient finiraient par battre à
 * des rythmes différents, sans que rien ne le justifie.
 *
 * Côté serveur, elle ne bat pas — il n'y a qu'un rendu, et son instant est
 * celui-là.
 */
export function useClockTick(): Ref<number> {
  const now = ref(Date.now())

  if (import.meta.client) {
    const tick = setInterval(() => {
      now.value = Date.now()
    }, TICK_MS)

    onScopeDispose(() => clearInterval(tick))
  }

  return now
}
