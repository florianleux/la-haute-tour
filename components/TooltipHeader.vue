<template>
  <!-- L'en-tête d'une infobulle : l'icône à gauche, le titre à côté, et ce qui le
       précise dessous. Partagé par les sorts et l'intoxication. -->
  <div class="flex items-center gap-3">
    <slot name="icon" />

    <div class="min-w-0">
      <p class="text-base font-bold">
        {{ title }}
      </p>
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ title: string }>()
</script>
