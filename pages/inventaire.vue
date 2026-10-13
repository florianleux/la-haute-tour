<template>
  <BaseCard title="Inventaire" />
</template>

<script setup lang="ts">
// Page d'attente de contenu : seul son titre existe, pour que le sac du camp
// (CooldownCamp) mène déjà quelque part. Au camp seulement, comme l'inventaire
// qu'elle montrera. Voir specs/ecrans.md#liste-des-écrans.
definePageMeta({ middleware: 'camp' })
</script>
