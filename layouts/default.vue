<template>
  <main class="relative flex min-h-screen items-center justify-center bg-slate-950 p-6 text-slate-100">
    <template v-if="blocked">
      <MaintenanceNotice />
    </template>
    <template v-else>
      <TopNav />
      <slot />
    </template>
  </main>
</template>

<script setup lang="ts">
// La maintenance ferme toutes les pages d'un coup, barre comprise : un joueur
// qui la subit ne doit rien pouvoir atteindre à côté, pas même s'enfuir vers
// les Sorts par une icône restée allumée. Voir specs/admin.md#maintenance.
const { user } = await useCurrentUser()
const game = user.value ? (await useGameState()).state : ref(null)

const route = useRoute()
const blocked = computed(() => blockedByMaintenance(game.value, route.path))
</script>
