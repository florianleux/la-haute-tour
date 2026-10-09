<template>
  <BaseCard title="La Haute Tour">
    <template #lead>
      L'accès se fait par Discord, sur invitation.
    </template>
    <BaseButton to="/api/auth/discord" external block class="mt-8">
      Se connecter avec Discord
    </BaseButton>
    <!-- En local seulement : voir server/api/auth/dev.get.ts. -->
    <BaseButton
      v-if="isDev"
      to="/api/auth/dev"
      external
      block
      class="mt-3"
    >
      Connexion locale (admin)
    </BaseButton>
  </BaseCard>
</template>

<script setup lang="ts">
definePageMeta({ public: true })

const isDev = import.meta.dev

const { user } = await useCurrentUser()

// Le middleware protège l'autre sens ; ici on évite de proposer une connexion
// à quelqu'un qui en a déjà une.
watchEffect(() => {
  if (user.value) {
    navigateTo('/')
  }
})
</script>
