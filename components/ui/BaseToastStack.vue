<template>
  <!-- Sous la barre d'icônes, pas par-dessus : une annonce large recouvrirait
       sinon la coupe et le buste sur un écran étroit. Et `pointer-events-none`
       sur toute la bande : les clics traversent vers l'écran en dessous. Un
       toast qui voudrait être cliquable le redemande pour lui seul
       (`pointer-events-auto`). -->
  <div class="pointer-events-none fixed inset-x-0 top-16 z-50 flex flex-col items-center gap-2 px-4">
    <slot />
  </div>
</template>

<script setup lang="ts">
/** La bande des annonces, au même endroit pour toutes : succès, actions refusées. */
</script>
