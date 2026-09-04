<script setup lang="ts">
import { CURRENT_USER_KEY } from '~/composables/useCurrentUser'
import type { MeResponse } from '~~/server/api/auth/me.get'

// Le bouton profil, réduit à une icône en haut à droite. Présent hors phase de
// jeu : la page /jouer le masque, parce qu'aucune action ne doit y détourner.
// Voir specs/ecrans.md#principes.
const route = useRoute()
const { data } = useNuxtData<MeResponse>(CURRENT_USER_KEY)
const user = computed(() => data.value?.user ?? null)

const hidden = computed(() => route.path === '/jouer')
</script>

<template>
  <NuxtLink
    v-if="user && !hidden"
    to="/profil"
    aria-label="Mon profil"
    class="absolute right-4 top-4 text-slate-400 transition-colors hover:text-slate-100"
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      class="h-7 w-7"
      aria-hidden="true"
    >
      <path
        d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0 2c-4.67 0-9 2.34-9 6.5V22h18v-1.5C21 16.34 16.67 14 12 14Z"
      />
    </svg>
  </NuxtLink>
</template>
