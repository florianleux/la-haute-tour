<template>
  <PlayText
    v-if="method"
    role="notice"
    class="text-amber-700"
  >
    {{ NOTICE[method] }}
  </PlayText>
</template>

<script setup lang="ts">
// Un envoi vide retenu (voir useEmptyAnswerHold) : la carte dit de renvoyer de
// la même façon pour l'envoyer quand même. Écrit une fois pour la question et le
// rattrapage, qui répondent pareil.
import type { SendMethod } from '~/composables/useEmptyAnswerHold'

defineProps<{ method: SendMethod | null }>()

const NOTICE: Record<SendMethod, string> = {
  enter: "Réponse vide. Appuie encore sur Entrée pour l'envoyer quand même.",
  click: "Réponse vide. Clique encore sur Valider pour l'envoyer quand même.",
}
</script>
