<template>
  <!-- Une remarque, puis les gestes possibles s'il y en a, comme les choix
       d'une réplique. Même gabarit que la boîte de dialogue (DialogueBox, en desktop), aux
       couleurs des fenêtres posées sur un décor. Tailles en `cqw` : le parent
       est un `@container`, la fenêtre suit la scène. Sa place vient de
       l'appelant. -->
  <div
    class="rounded-[1.3cqw] border-[0.25cqw] px-[2.1cqw] py-[1.5cqw] text-[1.36cqw] leading-relaxed shadow-2xl"
    :class="colors ?? PLAYER_COLORS"
  >
    <!-- Le slot remplace la remarque quand elle se met en scène autrement
         qu'en texte simple : le cri d'un boss, mot après mot. -->
    <!-- Une ligne au moins : vide, au départ d'un défilé, la fenêtre ne
         s'écrase pas pour regrandir au premier caractère. -->
    <p class="min-h-[1lh]">
      <slot>{{ remark }}</slot>
    </p>
    <DialogueChoiceList
      v-if="choices"
      :choices="choices"
      class="mt-[0.7cqw] font-semibold"
      @choose="run"
    />
  </div>
</template>

<script setup lang="ts">
// Une fenêtre de dialogue sans nom ni portrait, posée sur un décor : le joueur
// qui pense tout haut devant la porte du boss, ou une réplique de
// l'introduction du boss — la sienne ou celle du joueur, chacune à ses
// couleurs (`colors`). Chaque geste porte son action : le clic la lance, sans
// que l'appelant ait à retrouver le geste par son rang. Sans geste, elle ne
// propose rien : la réplique avance d'elle-même ou au clic sur la scène.
import type { DialogueChoices, DialogueAction } from '~~/utils/dialogue'

const props = defineProps<{
  /**
   * Ce qui s'y dit : la remarque du joueur, ou la réplique d'un boss. Ignorée
   * quand l'appelant remplit le slot à la place.
   */
  remark?: string
  /** Les gestes possibles, dans l'ordre où ils s'affichent : au moins un s'il y en a. */
  gestures?: readonly [DialogueAction, ...DialogueAction[]]
  /**
   * Fond, bordure et texte, en classes complètes : celles d'un boss qui parle
   * (catalogue des introductions). Absentes, les couleurs du joueur.
   */
  colors?: string
}>()

/** Le joueur qui pense tout haut : le cyan des fenêtres de la porte. */
const PLAYER_COLORS = 'border-[#051C26] bg-[#CFF] text-[#2579A6]'

const choices = computed((): DialogueChoices | null => {
  if (!props.gestures) {
    return null
  }
  const [first, ...rest] = props.gestures
  return [first.label, ...rest.map(gesture => gesture.label)]
})

/** Le geste cliqué, par son rang dans la liste. */
function run(rank: number): void {
  props.gestures?.[rank]?.run()
}
</script>
