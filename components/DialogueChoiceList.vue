<template>
  <div class="flex flex-col items-start">
    <BaseButton
      v-for="(choice, rank) in choices"
      :key="rank"
      variant="option"
      @click="emit('choose', rank)"
    >
      {{ choice }}
    </BaseButton>
  </div>
</template>

<script setup lang="ts">
// Les choix d'une réplique : une ligne par réponse, qu'on clique pour la dire —
// le geste des point & click, comme le genre à l'introduction. Voir le
// glossaire de specs/spec.md (« Choix »).
//
// Les réponses reprennent la taille du texte qui les entoure (voir la variante
// `option` de BaseButton) : c'est la boîte qui la porte, pas la liste.
import type { DialogueChoices } from '~~/utils/dialogue'

defineProps<{
  /** Les réponses, dans l'ordre où elles s'affichent. */
  choices: DialogueChoices
}>()

const emit = defineEmits<{
  /** Le joueur clique la réponse de ce rang. */
  choose: [number]
}>()
</script>
