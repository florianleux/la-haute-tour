<script setup lang="ts">
import { CURRENT_USER_KEY } from '~/composables/useCurrentUser'
import type { Ref } from 'vue'
import type { NavIconKey } from '~/utils/nav'
import type { GameState } from '~~/server/utils/game'
import type { MeResponse } from '~~/server/api/auth/me.get'

// La barre permanente, réduite à des icônes en haut à droite : la tour vers le
// jeu, la baguette vers les Sorts, le buste vers le profil, et le bouclier vers
// l'administration pour qui y a droit.
//
// Elle ne disparaît jamais — ce sont ses liens qui s'éteignent, et ce qui les
// éteint se décide dans navIcons(). Voir utils/nav.ts et specs/ecrans.md#principes.
const route = useRoute()
const { data } = useNuxtData<MeResponse>(CURRENT_USER_KEY)
const user = computed(() => data.value?.user ?? null)
const impersonator = computed(() => data.value?.impersonator ?? null)
const isAdmin = computed(() => isRealAdmin(data.value ?? null))

// La phase vient du serveur, sur toutes les pages : sans elle, la baguette
// resterait éteinte sur un profil ouvert directement par son URL alors que
// l'attente est ouverte. La lecture est partagée par sa clé — la page de jeu ne
// la redemande pas — et un visiteur sans compte, qui ne voit pas la barre, ne
// la déclenche pas.
const game: Ref<GameState | null> = user.value ? (await useGameState()).state : ref(null)

const icons = computed(() => navIcons({
  path: route.path,
  isAdmin: isAdmin.value,
  game: game.value,
}))

/**
 * Le tracé de chaque icône, à la clé que porte la barre. Une table plutôt qu'une
 * cascade de v-if : une icône ajoutée à navIcons() sans son dessin se voit ici,
 * au lieu de tomber silencieusement sur celui de la voisine.
 */
const PATHS: Record<NavIconKey, string> = {
  // Une tour crénelée, sa porte creusée dans le même tracé.
  tower: 'M5 3h2v2h2V3h2v2h2V3h2v2h2V3h2v19h-6v-6a2 2 0 0 0-4 0v6H5V3Z',
  // Une baguette en diagonale, l'étincelle à sa pointe.
  wand: 'M4.7 17.9 14.6 8l1.4 1.4-9.9 9.9-1.4-1.4ZM17.4 6.6 16 5.2l1.4-1.4 1.4 1.4-1.4 1.4Zm2.1 2.1 1.4-1.4 1.4 1.4-1.4 1.4-1.4-1.4ZM6.5 4.5l.9-2 .9 2 2 .9-2 .9-.9 2-.9-2-2-.9 2-.9Zm11 11 .9-2 .9 2 2 .9-2 .9-.9 2-.9-2-2-.9 2-.9Z',
  profile: 'M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0 2c-4.67 0-9 2.34-9 6.5V22h18v-1.5C21 16.34 16.67 14 12 14Z',
  admin: 'M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3Z',
}
</script>

<template>
  <!-- Qui joue, à gauche : réservé à l'admin, et sur toutes les pages comme la
       barre elle-même. Voir specs/admin.md#incarnation. -->
  <div v-if="isAdmin" class="absolute left-4 top-4">
    <ImpersonationSelect
      :acting-as="user"
      :impersonator="impersonator"
      :test-players="data?.testPlayers ?? []"
    />
  </div>

  <nav v-if="user" class="absolute right-4 top-4 flex items-center gap-3">
    <BaseIconLink
      v-for="icon in icons"
      :key="icon.key"
      :to="icon.to"
      :label="icon.label"
      :state="icon.state"
    >
      <path :d="PATHS[icon.key]" />
    </BaseIconLink>
  </nav>
</template>
