<template>
  <BaseCard v-if="failed">
    <BaseNotice>
      Impossible de préparer le banc. Hors développement, incarne d'abord un joueur test.
    </BaseNotice>
  </BaseCard>
  <Suspense v-else-if="ready">
    <GamePage />
  </Suspense>
  <BaseCard v-else>
    <BaseLoading>
      Le champignon repousse…
    </BaseLoading>
  </BaseCard>
</template>

<script setup lang="ts">
// Banc du Champignon appétissant : le vrai jeu, monté ici et non sur `/` pour que
// recharger la page remette tout à zéro. Partie neuve, au camp au repos, leçons
// vues sauf celle du Champignon : le cueillir, le manger, jouer l'ascension.
//
// Admin seulement. Hors développement, sur un joueur test incarné : un banc ne
// jette pas la partie d'un vrai compte. Voir server/api/admin/camp-lesson.post.ts.
import { GAME_STATE_KEY } from '~/composables/useGameState'
import GamePage from '~/pages/index.vue'
import { TEAM_IDS } from '~~/shared/utils/teams'

definePageMeta({ admin: true })

const { user } = await useCurrentUser()

const ready = ref(false)
const failed = ref(false)

onMounted(async () => {
  try {
    await $fetch('/api/admin/camp-lesson', { method: 'POST', body: { team: user.value?.team ?? TEAM_IDS[0], lesson: 'mushroom' } })
    // L'état lu avant la remise à zéro est périmé : le jeu le relit en montant.
    clearNuxtData([GAME_STATE_KEY, 'items'])
    ready.value = true
  }
  catch {
    failed.value = true
  }
})
</script>
