<script setup lang="ts">
import { CURRENT_USER_KEY } from '~/composables/useCurrentUser'
import type { MeResponse } from '~~/server/api/auth/me.get'

// Les liens permanents, réduits à des icônes en haut à droite : la tour vers le
// jeu, le bouclier vers l'administration pour qui y a droit, le profil.
// Absents de la page de jeu : pendant une question, rien ne doit détourner.
// Voir specs/ecrans.md#principes.
const route = useRoute()
const { data } = useNuxtData<MeResponse>(CURRENT_USER_KEY)
const user = computed(() => data.value?.user ?? null)

const hidden = computed(() => route.path === '/jouer')
</script>

<template>
  <nav v-if="user && !hidden" class="absolute right-4 top-4 flex items-center gap-3">
    <BaseIconLink to="/jouer" label="Le jeu">
      <!-- Une tour crénelée, sa porte creusée dans le même tracé. -->
      <path
        d="M5 3h2v2h2V3h2v2h2V3h2v2h2V3h2v19h-6v-6a2 2 0 0 0-4 0v6H5V3Z"
      />
    </BaseIconLink>

    <BaseIconLink v-if="user.isAdmin" to="/admin" label="Administration">
      <path
        d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3Z"
      />
    </BaseIconLink>

    <BaseIconLink to="/profil" label="Mon profil">
      <path
        d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0 2c-4.67 0-9 2.34-9 6.5V22h18v-1.5C21 16.34 16.67 14 12 14Z"
      />
    </BaseIconLink>
  </nav>
</template>
