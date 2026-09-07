<template>
  <!-- Barre de progression pendant qu'une page charge ses données : les lectures
       se font avant que la nouvelle page s'affiche, sans ça rien ne bouge. -->
  <NuxtLoadingIndicator color="#818cf8" />
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>

<script setup lang="ts">
useHead({
  title: 'La Haute Tour',
  link: [
    { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
    { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
    { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Platypi:ital,wght@0,300..800;1,300..800&display=swap' },
  ],
})
</script>
