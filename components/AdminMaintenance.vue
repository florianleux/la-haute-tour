<template>
  <section>
    <h2 class="text-lg font-semibold">
      Maintenance
    </h2>

    <BaseHint class="mt-2">
      Fermer le jeu empêche les joueurs d'obtenir une nouvelle question. Ceux qui en
      tiennent une la finissent et lisent leur verdict. Les attentes continuent de
      courir. Toi, tu joues normalement.
    </BaseHint>

    <BaseNotice v-if="failed" class="mt-4">
      L'état de la maintenance n'a pas pu être lu ou changé. Réessaie.
    </BaseNotice>

    <BaseHint v-if="since" class="mt-4" tone="warning">
      Jeu fermé depuis le {{ formatDayTime(since) }}.
    </BaseHint>
    <BaseHint v-else class="mt-4" tone="success">
      Jeu ouvert.
    </BaseHint>

    <BaseButton class="mt-4" :loading="pending" @click="set(!closed)">
      {{ closed ? 'Rouvrir le jeu' : 'Fermer le jeu' }}
    </BaseButton>
  </section>
</template>

<script setup lang="ts">
// L'interrupteur qui ferme le jeu aux joueurs. Les admins continuent de jouer.
// Voir specs/admin.md#maintenance.
const { since, failed, pending, set } = await useMaintenance()

const closed = computed(() => since.value !== null)
</script>
