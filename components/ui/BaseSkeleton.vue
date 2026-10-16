<template>
  <!-- La forme de ce qui arrive, à la place du mot « chargement ». Un écran qui
       garde sa silhouette pendant la lecture ne saute pas quand elle revient. -->
  <span
    class="block animate-pulse rounded"
    :class="[height, width, parchment ? 'bg-amber-900/15' : 'bg-slate-800']"
    aria-hidden="true"
  />
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  /** Hauteur du bloc, en classe Tailwind : une ligne de texte par défaut. */
  height?: string
  /** Largeur, pour que deux lignes voisines n'aient pas la même longueur. */
  width?: string
  /** Posé sur un parchemin : l'encre du papier plutôt que le gris de l'écran. */
  parchment?: boolean
}>(), {
  height: 'h-4',
  width: 'w-full',
})
</script>
