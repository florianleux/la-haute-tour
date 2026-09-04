<script setup lang="ts">
// L'accueil est un CTA pour les nouveaux : un joueur qui a déjà commencé est
// redirigé vers /jouer, où le serveur le renvoie à sa phase. Voir specs/ecrans.md.
const { user } = await useCurrentUser()
const { state, failed } = await useGameState()

watchEffect(() => {
  if (state.value?.started) {
    navigateTo('/jouer')
  }
})
</script>

<template>
  <BaseCard v-if="user" :title="`Bienvenue, ${user.username} !`">
    <template #lead>
      Prêt à gravir la Haute Tour ?
    </template>

    <BaseNotice v-if="failed">
      Impossible de lire ton état. Recharge la page.
    </BaseNotice>

    <BaseButton v-if="state" to="/jouer" block class="mt-8">
      Démarrer mon ascension
    </BaseButton>
  </BaseCard>
</template>
