<template>
  <span
    class="absolute aspect-square"
    :style="glow && { '--glow': glow }"
  >
    <span
      v-if="glow"
      class="absolute inset-[-25%] rounded-full bg-[radial-gradient(circle_closest-side,var(--glow),transparent)]"
    />
    <span class="absolute inset-0 bg-white [clip-path:polygon(50%_0,61%_39%,100%_50%,61%_61%,50%_100%,39%_61%,0_50%,39%_39%)]" />
  </span>
</template>

<script setup lang="ts">
// Une étincelle : une étoile blanche à quatre branches, en position absolue.
// Taille, place et animation arrivent par `class` et `style` depuis l'appelant.
// Son halo est un disque en dégradé sous l'étoile, pas un `drop-shadow` : le
// filtre, sur une étoile qui grossit, Safari le peint sur toute la boîte
// carrée. Voir CLAUDE.md#styling.

defineProps<{
  /** La couleur du halo ; sans elle, l'étoile n'en a pas. Sa taille suit
   *  celle de l'étoile (1,5 fois), pas un flou réglé en px. */
  glow?: string
}>()
</script>
