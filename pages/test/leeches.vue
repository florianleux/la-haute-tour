<template>
  <BaseCard>
    <BaseNotice v-if="failed">
      Impossible de préparer le banc. Hors développement, incarne d'abord un joueur test.
    </BaseNotice>
    <BaseLoading v-else>
      Ascension jusqu'au coffre du Filet…
    </BaseLoading>
  </BaseCard>
</template>

<script setup lang="ts">
// Banc des Sangsues : tout le parcours du Filet à sangsues, en vrai. Le joueur
// servi arrive sur le verdict d'une question loot, coffre fermé. Ouvrir le coffre
// donne le Filet ; une erreur, avec sa dernière vie, le ramène au camp pour la
// leçon de Michel et l'onglet Sangsues du Volumen.
//
// Admin seulement. Hors développement, sur un joueur test incarné : un banc ne
// jette pas la partie d'un vrai compte. Voir server/api/admin/leech-bench.post.ts.
definePageMeta({ admin: true })

const failed = ref(false)

onMounted(async () => {
  try {
    await $fetch('/api/admin/leech-bench', { method: 'POST' })
    // Rechargée en entier : l'état de jeu et le joueur déjà lus sont périmés.
    reloadNuxtApp({ path: '/' })
  }
  catch {
    failed.value = true
  }
})
</script>
