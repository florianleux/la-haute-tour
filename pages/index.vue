<script setup lang="ts">
const { user } = await useCurrentUser()
</script>

<template>
  <BaseCard v-if="user" :title="`Bienvenue, ${user.username}`">
    <template #lead>
      Étage {{ user.currentFloor }} — {{ user.lives }} vies.
    </template>
  </BaseCard>
</template>
