<script setup lang="ts">
// The accueil is the hub: the name comes from the identity endpoint, floor, lives
// and the phase from the game state. See specs/ecrans.md.
const { user } = await useCurrentUser()
const { state, failed } = await useGameState()
</script>

<template>
  <BaseCard v-if="user" :title="`Bienvenue, ${user.username}`">
    <div v-if="state" class="mt-6 grid grid-cols-2 gap-3">
      <BaseStat label="Étage" :value="state.floor" />
      <BaseStat label="Vies" :value="state.lives" />
    </div>
    <BaseNotice v-else-if="failed">
      Impossible de lire ton étage et tes vies. Recharge la page.
    </BaseNotice>

    <!-- Le libellé annonce ce que le joueur va trouver : il vient de la phase
         renvoyée par le serveur, jamais d'une déduction du client. -->
    <BaseButton v-if="state" to="/jouer" block class="mt-8">
      {{ mainActionLabel(state) }}
    </BaseButton>

    <BaseButton to="/profil" variant="ghost" block class="mt-3">
      Mon profil
    </BaseButton>
  </BaseCard>
</template>
