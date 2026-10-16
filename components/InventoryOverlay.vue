<template>
  <CampOverlay v-slot="{ closing }" label="Inventaire" close-label="Fermer l'Inventaire" @close="$emit('close')">
    <BaseCard title="Inventaire" class="relative my-auto" v-bind="fadeLayer(closing, '0s')" />
  </CampOverlay>
</template>

<script setup lang="ts">
// Boîte en attente de contenu : seul son titre existe, pour que le sac du camp
// (CooldownCamp) ouvre déjà quelque chose. Au camp seulement, comme l'inventaire
// qu'elle montrera. Voir specs/ecrans.md#liste-des-écrans.
defineEmits<{ close: [] }>()
</script>
