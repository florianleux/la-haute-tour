<template>
  <span class="font-bold text-slate-100">{{ label }}</span>
</template>

<script setup lang="ts">
// La réponse affichée d'une question — celle qu'on montre au joueur sur échec,
// jamais celle qui sert au matching. Voir specs/spec.md#glossaire.
defineProps<{ label: string }>()
</script>
