<template>
  <div
    class="relative aspect-[672/509] w-full motion-safe:animate-title-drop"
    role="img"
    aria-label="La Haute Tour"
  >
    <div class="absolute inset-0 motion-safe:animate-title-float">
      <img
        src="/images/title.webp"
        alt=""
        class="block w-full"
      >
      <!-- Le reflet, découpé à la forme du logo par son propre alpha. -->
      <div class="absolute inset-0 bg-[linear-gradient(110deg,transparent_40%,rgb(255_255_255/0.7)_50%,transparent_60%)] bg-size-[300%_100%] [mask-image:url(/images/title.webp)] [mask-size:100%_100%] motion-safe:animate-title-sheen motion-reduce:hidden" />
      <SparkleStar
        v-for="gem in GEMS"
        :key="gem.delay"
        glow="#fff7d6"
        class="w-[5%] opacity-0 motion-safe:animate-twinkle"
        :style="{
          left: `calc(${(gem.x / 672) * 100}% - 2.5%)`,
          top: `calc(${(gem.y / 509) * 100}% - 2.5% * 672 / 509)`,
          animationDelay: `${1.2 + gem.delay}s`,
        }"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
// Le titre de la page de connexion : le logo tombe du haut de la fenêtre et
// rebondit (`title-drop`), puis flotte (`title-float`) ; un reflet le
// traverse (`title-sheen`) et les gemmes scintillent tour à tour (`twinkle`).

/** Le centre de chaque gemme, en px du logo (672×509), et son décalage dans le cycle. */
const GEMS = [
  { x: 116, y: 101, delay: 0 },
  { x: 346, y: 183, delay: 1 },
  { x: 628, y: 156, delay: 2 },
  { x: 251, y: 319, delay: 3 },
]
</script>
