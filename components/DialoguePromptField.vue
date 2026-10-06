<template>
  <!-- Le champ prend le clavier en arrivant, et sa borne haute est celle du
       champ lui-même — la frappe s'arrête plutôt que d'annoncer une faute après
       coup. La borne basse, elle, retient le dialogue : voir `dialogueGesture`.

       Entrée répond depuis le champ : le raccourci de la scène
       (`useAdvanceOnEnter`) laisse la touche aux champs de saisie. -->
  <div class="flex items-end gap-2">
    <BaseInput
      v-model="answer"
      class="flex-1"
      autofocus
      clear
      :label="prompt.label"
      :maxlength="prompt.maxLength"
      @keydown.enter.prevent="emit('submit')"
    />
    <BaseButton variant="text" :disabled="awaiting" @click="emit('submit')">
      Répondre
    </BaseButton>
  </div>
</template>

<script setup lang="ts">
// L'invite d'une réplique : une réponse libre à écrire, comme le nom à
// l'introduction. Voir le glossaire de specs/spec.md (« Invite »). Elle ne
// décide pas si la saisie passe — c'est le déroulé qui le dit (`awaiting`) —,
// elle la montre et la rend.
import type { DialoguePrompt } from '~~/utils/dialogue'

defineProps<{
  /** Le libellé et les bornes de ce qui est demandé. */
  prompt: DialoguePrompt
  /** La saisie n'entre pas encore dans les bornes : « Répondre » reste éteint. */
  awaiting: boolean
}>()

/**
 * Ce que le joueur écrit. Tenu par le déroulé (voir useDialogue), pas par le
 * champ : c'est lui qui décide quand le geste passe, et qui vide la saisie en
 * changeant de réplique.
 */
const answer = defineModel<string>({ required: true })

const emit = defineEmits<{
  /** Le joueur valide sa saisie : à la scène de faire avancer le dialogue. */
  submit: []
}>()
</script>
