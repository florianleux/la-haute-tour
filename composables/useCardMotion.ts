import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { ComputedRef, Ref } from 'vue'

/**
 * L'attente d'un geste, jouée pendant que la requête part : `judging` sur
 * Valider (l'encre remonte, le médaillon tremble jusqu'au verdict), `leaving`
 * sur Suivant (le verdict glisse et s'efface). Voir specs/ecrans.md.
 */
export type CardMotion = 'judging' | 'leaving'

/** Chaque attente décrite d'un seul endroit, panneau et médaillon ensemble. */
export const CARD_MOTIONS = {
  judging: { panel: 'motion-safe:animate-ink-lift', medallion: 'motion-safe:animate-judge-quiver!' },
  leaving: { panel: 'motion-safe:animate-verdict-leave', medallion: '' },
} as const

/** Ce que la carte entière encaisse au verdict, ou au coffre. */
export const CARD_REACTIONS = {
  hit: 'motion-safe:animate-hit',
  hop: 'motion-safe:animate-hop',
  mauled: 'motion-safe:animate-mauled',
  quake: 'motion-safe:animate-quake',
  pop: 'motion-safe:animate-pop',
} as const

// ponytail: durée fixe, plus longue que toutes les entrées (la plus longue,
// le bouton, 1,35 s) ; à lire sur animationend si une entrée s'allonge.
const ARRIVAL_MS = 2000

export interface CardMotionState {
  /** L'arrivée joue (`data-arriving`) : l'attribut tombe quand elle est finie. */
  arriving: Ref<boolean>
  /** Le cadre qui monte au jugement, et retombe quand il s'achève. */
  lift: ComputedRef<string>
}

/**
 * Les gestes d'une carte de jeu, écrits une fois pour le cadre de l'ascension
 * et du rattrapage (PlayFrame) et la carte de l'épreuve du boss (BossFlagTrial).
 * L'arrivée ne se joue qu'une fois : sans ça, la fin du jugement rendrait au
 * médaillon et au cadre leur animation d'arrivée, qui repartirait de zéro. Le
 * cadre retombe s'il prend la suite d'un cadre soulevé (`start.settling`), ou
 * sur place quand le jugement s'achève sans démontage.
 */
export function useCardMotion(
  motion: () => CardMotion | undefined,
  start: { arriving: boolean, settling: boolean },
): CardMotionState {
  const arriving = ref(start.arriving)
  let arrival: ReturnType<typeof setTimeout> | undefined

  onMounted(() => {
    if (arriving.value) {
      arrival = setTimeout(() => {
        arriving.value = false
      }, ARRIVAL_MS)
    }
  })
  onBeforeUnmount(() => clearTimeout(arrival))

  const settling = ref(start.settling)
  watch(motion, (now, before) => {
    settling.value = before === 'judging' && now !== 'judging'
  })

  // En `!` : la classe d'arrivée reste tant que le cadre est monté, et elle
  // l'emporterait sinon.
  const lift = computed(() => {
    if (motion() === 'judging') {
      return 'motion-safe:animate-frame-lift!'
    }
    return settling.value ? 'motion-safe:animate-frame-settle!' : ''
  })

  return { arriving, lift }
}
