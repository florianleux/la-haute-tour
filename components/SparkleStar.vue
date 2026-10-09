<template>
  <span class="absolute aspect-square bg-white [clip-path:polygon(50%_0,61%_39%,100%_50%,61%_61%,50%_100%,39%_61%,0_50%,39%_39%)]" />
</template>

<script setup lang="ts">
// Une étincelle : une étoile blanche à quatre branches, en position absolue.
// Taille, place et animation arrivent par `class` et `style` depuis l'appelant.
// Son halo doit venir d'un parent : un `drop-shadow` posé sur l'étoile
// elle-même serait rogné par son propre clip-path.
</script>
