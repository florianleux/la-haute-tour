<template>
  <!-- La croix des boîtes du camp. Sa place vient de l'appelant, par `class`. -->
  <BaseIconButton :label="label" @click="$emit('click')">
    <path d="M6.4 5 12 10.6 17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6L6.4 19 5 17.6l5.6-5.6L5 6.4 6.4 5Z" />
  </BaseIconButton>
</template>

<script setup lang="ts">
defineProps<{
  /** Ce qu'elle ferme, pour une synthèse vocale : « Fermer le Volumen ». */
  label: string
}>()

defineEmits<{ click: [] }>()
</script>
