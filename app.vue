<template>
  <!-- Barre de progression pendant qu'une page charge ses données : les lectures
       se font avant que la nouvelle page s'affiche, sans ça rien ne bouge. -->
  <NuxtLoadingIndicator color="#818cf8" />
  <!-- Le format décide en CSS, avant tout script : rendu côté serveur, le jeu
       ne passe jamais devant le mur. Voir specs/ecrans.md#mur-mobile. Les écrans
       d'administration (layout `admin`) en sont exemptés. -->
  <MobileWall v-if="!adminLayout" />
  <div :class="{ 'mobile:hidden': !adminLayout }">
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </div>
</template>

<script setup lang="ts">
// Connue au rendu serveur comme au client : le premier affichage reste le bon.
const route = useRoute()
const adminLayout = computed(() => route.meta.layout === 'admin')

useHead({
  title: 'La Haute Tour',
  link: [
    // La Tour, dessinée en SVG plutôt qu'en .ico : un seul fichier, net à toutes
    // les tailles d'onglet, et modifiable comme du code.
    { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
    { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
    { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
    { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Platypi:ital,wght@0,300..800;1,300..800&display=swap' },
  ],
})
</script>
