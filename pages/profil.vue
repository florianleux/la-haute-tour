<script setup lang="ts">
// Identity only: no floor, no lives (they live on the accueil), no cheat flag
// (admin only). See specs/ecrans.md.
const { user } = await useCurrentUser()
const { logout, failed } = useLogout()

const memberSince = computed(() => (user.value ? formatDay(user.value.createdAt) : ''))
</script>

<template>
  <BaseCard v-if="user" title="Profil">
    <template #lead>
      {{ user.username }} — membre depuis le {{ memberSince }}.
    </template>
    <BaseButton block class="mt-8" @click="logout">
      Se déconnecter
    </BaseButton>
    <BaseNotice v-if="failed">
      La déconnexion a échoué. Réessaie.
    </BaseNotice>
    <BaseButton to="/" variant="ghost" block class="mt-3">
      Retour à l'accueil
    </BaseButton>
  </BaseCard>
</template>
