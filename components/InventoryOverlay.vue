<template>
  <CampOverlay v-slot="{ close }" label="Inventaire" :game="game" @close="$emit('close')">
    <BaseCard title="Inventaire" class="relative my-auto">
      <BaseCloseButton label="Fermer l'Inventaire" class="absolute right-4 top-4" @click="close" />
    </BaseCard>
  </CampOverlay>
</template>

<script setup lang="ts">
// Boîte en attente de contenu : seul son titre existe, pour que le sac du camp
// (CooldownCamp) ouvre déjà quelque chose. Au camp seulement, comme l'inventaire
// qu'elle montrera. Voir specs/ecrans.md#liste-des-écrans.
defineEmits<{ close: [] }>()

// L'état de jeu : la fermeture si la partie quitte le camp (CampOverlay).
const game = await useGameState()
</script>
