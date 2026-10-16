<template>
  <!-- Qui joue, en haut à gauche : réservé à l'admin, et sur toutes les pages.
       Voir specs/admin.md#incarnation. -->
  <div v-if="isAdmin" class="absolute left-4 top-4 z-20">
    <ImpersonationSelect
      :acting-as="user"
      :impersonator="impersonator"
      :test-players="data?.testPlayers ?? []"
    />
  </div>
</template>

<script setup lang="ts">
import { CURRENT_USER_KEY } from '~/composables/useCurrentUser'
import type { MeResponse } from '~~/server/api/auth/me.get'

const { data } = useNuxtData<MeResponse>(CURRENT_USER_KEY)
const user = computed(() => data.value?.user ?? null)
const impersonator = computed(() => data.value?.impersonator ?? null)
const isAdmin = computed(() => isRealAdmin(data.value ?? null))
</script>
