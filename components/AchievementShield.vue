<template>
  <!-- L'écu de la guilde, aux couleurs posées par le layout (--team-ink,
       --team-paper) : le seul visage d'un succès obtenu. Les succès n'ont pas de
       dessin propre, voir specs/succes.md#affichage. -->
  <svg viewBox="0 0 64 64" role="img" :aria-label="alt || undefined">
    <rect width="64" height="64" class="fill-(--team-ink)" />
    <path
      d="M32 12.5 L47 18.5 V32 C47 42.5 39.5 48.5 32 51.5 C24.5 48.5 17 42.5 17 32 V18.5 Z"
      class="fill-(--team-paper)"
    />
  </svg>
</template>

<script setup lang="ts">
// Écrit une fois : la grille et l'annonce le montrent toutes les deux. La taille
// vient de l'appelant — Vue pose sa classe sur le dessin.
withDefaults(defineProps<{ alt?: string }>(), { alt: '' })
</script>
