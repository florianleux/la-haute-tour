<script setup lang="ts">
definePageMeta({ public: true })

const { user } = await useCurrentUser()

// Le middleware protège l'autre sens ; ici on évite de proposer une connexion
// à quelqu'un qui en a déjà une.
watchEffect(() => {
  if (user.value) {
    navigateTo('/')
  }
})
</script>

<template>
  <BaseCard title="La Haute Tour">
    <template #lead>
      L'accès se fait par Discord, sur invitation.
    </template>
    <BaseButton to="/api/auth/discord" class="mt-8 w-full">
      Se connecter avec Discord
    </BaseButton>
  </BaseCard>
</template>
