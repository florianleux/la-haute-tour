<script setup lang="ts">
// The accueil is the hub: the name comes from the identity endpoint, floor, lives
// and the phase from the game state. See specs/ecrans.md.
const { user } = await useCurrentUser()
const { state, failed } = await useGameState()

// En attente, on tombe directement sur l'écran d'attente : l'accueil ne sert
// qu'à choisir de jouer, pas à revoir un compteur. Voir specs/ecrans.md.
watchEffect(() => {
  if (state.value?.phase === 'cooldown') {
    navigateTo('/jouer')
  }
})
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
  </BaseCard>
</template>
