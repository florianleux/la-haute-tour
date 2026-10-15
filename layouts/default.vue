<template>
  <main class="relative flex min-h-screen items-center justify-center overflow-clip bg-slate-950 p-6 text-slate-100">
    <!-- `overflow-clip` : le cadre de jeu qui encaisse un coup (PlayFrame) déborde
         le temps de sa secousse, et ferait clignoter des barres de défilement. -->
    <template v-if="blocked">
      <MaintenanceNotice />
    </template>
    <template v-else>
      <ImpersonationCorner />
      <!-- Dans le `v-else` comme le sélecteur : la maintenance ferme tout, et il
           n'y a rien à annoncer à qui ne peut pas jouer. -->
      <AchievementToasts />
      <slot />
    </template>
  </main>
</template>

<script setup lang="ts">
// La maintenance ferme toutes les pages d'un coup : un joueur qui la subit ne
// doit rien pouvoir atteindre à côté. Voir specs/admin.md#maintenance.
const { user } = await useCurrentUser()
const game = user.value ? (await useGameState()).state : ref(null)

const route = useRoute()
const blocked = computed(() => blockedByMaintenance(game.value, route.path))
</script>
