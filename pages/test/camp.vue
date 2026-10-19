<template>
  <BaseCard>
    <BaseNotice v-if="failed">
      Impossible de remettre la partie à la sortie de l'introduction. Hors
      développement, incarne d'abord un joueur test.
    </BaseNotice>
    <BaseLoading v-else>
      Retour à la sortie de l'introduction…
    </BaseLoading>
  </BaseCard>
</template>

<script setup lang="ts">
// Le banc de la leçon du camp : le premier parcours d'un joueur neuf, de la
// sortie de l'introduction à la première question. Le joueur servi est remis à
// zéro, introduction finie et Fromage en poche, puis la page de jeu se recharge :
// il arrive au camp, et Michel donne sa leçon. Une vraie partie, pas un état
// simulé : le don du Fromage et la leçon datée passent par le serveur.
//
// Le joueur reçoit l'une des deux guildes au hasard : la leçon se voit entière,
// bannière comprise, sous l'une ou l'autre couleur. Écrite sur lui pour de bon,
// comme le reste de ce que le banc remet à zéro. Le joueur sans équipe, dont la
// leçon saute la bannière, se voit au banc du camp (/test/cooldown).
//
// Admin seulement. Hors développement, sur un joueur test incarné : un banc ne
// jette pas la partie d'un vrai compte. Voir server/api/admin/camp-lesson.post.ts.
import { TEAM_IDS } from '~~/shared/utils/teams'

definePageMeta({ admin: true })

const failed = ref(false)

const team = TEAM_IDS[Math.floor(Math.random() * TEAM_IDS.length)]

onMounted(async () => {
  try {
    await $fetch('/api/admin/camp-lesson', { method: 'POST', body: { team } })
    // Rechargée en entier : l'état de jeu et le joueur déjà lus sont périmés.
    reloadNuxtApp({ path: '/' })
  }
  catch {
    failed.value = true
  }
})
</script>
