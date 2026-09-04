<script setup lang="ts">
// Les fiches joueurs. Lecture sans effet : ouvrir l'onglet ne fait avancer
// aucune partie. Voir specs/admin.md#gestion-des-joueurs.
const { players, failed, loading, acting, skipCooldown, grantLife } = await useAdminPlayers()

const actionFailed = ref(false)

// Les délais s'affichent à la minute : les rafraîchir chaque demi-minute suffit
// à ce qu'aucun chiffre affiché ne soit faux.
const TICK_MS = 30_000
const now = ref(Date.now())

if (import.meta.client) {
  const tick = setInterval(() => {
    now.value = Date.now()
  }, TICK_MS)
  onScopeDispose(() => clearInterval(tick))
}

// Pas de « personne » quand la lecture a échoué : ce serait la même phrase pour
// « aucun joueur » et « je ne sais pas ».
const emptyMessage = computed(
  () => (players.value.length || failed.value ? null : 'Aucun joueur inscrit pour l\'instant.'),
)

async function act(action: (userId: number) => Promise<boolean>, userId: number): Promise<void> {
  actionFailed.value = !await action(userId)
}
</script>

<template>
  <BaseSection title="Joueurs">
    <template #lead>
      Où en est chacun, et les deux gestes qui peuvent le débloquer.
    </template>

    <BaseNotice v-if="actionFailed">
      L'action a échoué. Réessaie.
    </BaseNotice>
    <BaseNotice v-if="failed">
      Impossible de lire les joueurs. Recharge la page.
    </BaseNotice>

    <BaseLoading v-if="loading" class="mt-6">
      Mise à jour des joueurs…
    </BaseLoading>

    <div v-if="emptyMessage" class="mt-6 rounded-xl border border-slate-800 px-4 py-3 text-sm text-slate-500">
      {{ emptyMessage }}
    </div>

    <div class="mt-6 grid gap-4 sm:grid-cols-2">
      <AdminPlayerCard
        v-for="player in players"
        :key="player.userId"
        :player="player"
        :busy="acting"
        :now="now"
        @skip-cooldown="act(skipCooldown, player.userId)"
        @grant-life="act(grantLife, player.userId)"
      />
    </div>
  </BaseSection>
</template>
