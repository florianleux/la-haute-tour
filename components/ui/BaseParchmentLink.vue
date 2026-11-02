<template>
  <button
    type="button"
    :disabled="disabled"
    class="shrink-0 cursor-pointer font-semibold uppercase tracking-wide text-amber-900 underline decoration-amber-900/40 underline-offset-[0.2em] transition-colors hover:text-amber-950 hover:decoration-amber-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-700 disabled:cursor-wait disabled:opacity-50"
    @click="$emit('click')"
  >
    <slot />
  </button>
</template>

<script setup lang="ts">
// Un geste écrit à l'encre sur un parchemin : un mot souligné, pas une planche.
// BaseCardButton porte l'action unique d'un écran ; celui-ci les petits gestes
// qui s'alignent à côté d'un texte (« OK », « Tout marquer lu »). Sa taille suit
// le texte où il se pose.
defineProps<{ disabled?: boolean }>()

defineEmits<{ click: [] }>()
</script>
