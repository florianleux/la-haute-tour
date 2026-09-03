<template>
  <!-- Barre de progression pendant qu'une page charge ses données : les lectures
       se font avant que la nouvelle page s'affiche, sans ça rien ne bouge. -->
  <NuxtLoadingIndicator color="#818cf8" />
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
