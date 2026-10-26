<template>
  <!-- Une remarque, puis les gestes possibles, comme les choix d'une réplique.
       Même gabarit que la boîte de dialogue (DialogueBox, en desktop), aux
       couleurs des fenêtres posées sur un décor. Tailles en `cqw` : le parent
       est un `@container`, la fenêtre suit la scène. Sa place vient de
       l'appelant. -->
  <div
    class="rounded-[1.3cqw] border-[0.25cqw] border-[#051C26] bg-[#CFF] px-[2.1cqw] py-[1.5cqw] text-[1.36cqw] leading-relaxed text-[#2579A6] shadow-2xl"
  >
    <p>{{ remark }}</p>
    <DialogueChoiceList
      :choices="choices"
      class="mt-[0.7cqw] font-semibold"
      @choose="gestures[$event]!.run()"
    />
  </div>
</template>

<script setup lang="ts">
// Une fenêtre de dialogue sans locuteur : le joueur qui pense tout haut devant
// un décor (la porte du boss). Chaque geste porte son action : le clic la lance,
// sans que l'appelant ait à retrouver le geste par son rang.
import type { DialogueChoices, DialogueAction } from '~~/utils/dialogue'

const props = defineProps<{
  /** Ce que le joueur se dit. */
  remark: string
  /** Les gestes possibles, dans l'ordre où ils s'affichent : au moins un. */
  gestures: readonly [DialogueAction, ...DialogueAction[]]
}>()

const choices = computed((): DialogueChoices => {
  const [first, ...rest] = props.gestures
  return [first.label, ...rest.map(gesture => gesture.label)]
})
</script>
