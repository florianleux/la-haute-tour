<template>
  <AchievementImage v-if="unlocked" :id="id" :alt="alt" class="aspect-square rounded-sm" />
  <!-- Pas encore obtenu : un point d'interrogation, rien de plus, le cadre
       serré sur lui. Sa couleur et sa marge viennent de l'appelant, par
       `class`. -->
  <svg v-else viewBox="1.25 1.2 7.5 7.5" class="aspect-square" aria-hidden="true">
    <text x="5" y="8.6" text-anchor="middle" font-size="9.5" font-weight="800" fill="currentColor">?</text>
  </svg>
</template>

<script setup lang="ts">
// Ce qu'un succès montre de lui : son dessin une fois obtenu, un « ? » avant.
// Écrit une fois pour la tuile du mur et pour son infobulle.
import type { AchievementId } from '~~/shared/utils/achievements'

defineProps<{
  id: AchievementId
  unlocked: boolean
  alt?: string
}>()
</script>
