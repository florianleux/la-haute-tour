<template>
  <!-- Un disque de rayons, centré sur la boîte de l'appelant et fondu vers le
       bord. Sa largeur, son opacité et son animation (qui l'allume ou le fait
       tourner) viennent de l'appelant, par `class`. -->
  <div
    class="absolute left-1/2 top-1/2 aspect-square -translate-x-1/2 -translate-y-1/2 rounded-full bg-[repeating-conic-gradient(var(--rays-color)_0deg_8deg,transparent_8deg_24deg)] [mask-image:radial-gradient(circle,black_15%,transparent_68%)]"
    :style="{ '--rays-color': color }"
  />
</template>

<script setup lang="ts">
// Les rayons derrière un objet qui se montre : le sort qui jaillit du coffre
// (ChestCard), l'objet obtenu (ItemReveal).

defineProps<{
  /** La couleur des rayons. */
  color: string
}>()
</script>
