<template>
  <!-- La forme de ce qui arrive, à la place du mot « chargement ». Un écran qui
       garde sa silhouette pendant la lecture ne saute pas quand elle revient. -->
  <span
    class="block animate-pulse rounded bg-slate-800"
    :class="[height, width]"
    aria-hidden="true"
  />
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  /** Hauteur du bloc, en classe Tailwind : une ligne de texte par défaut. */
  height?: string
  /** Largeur, pour que deux lignes voisines n'aient pas la même longueur. */
  width?: string
}>(), {
  height: 'h-4',
  width: 'w-full',
})
</script>
