<template>
  <BaseSection title="Pertes de focus">
    <template #lead>
      Les réponses envoyées parce que le joueur a quitté la page pendant qu'un timer
      tournait. Dix en cinq questions se remarquent, une par soirée non.
    </template>

    <BaseNotice v-if="failed">
      Impossible de lire les pertes de focus. Recharge la page.
    </BaseNotice>

    <BaseLoading v-if="loading" class="mt-6">
      Mise à jour des flags…
    </BaseLoading>

    <BaseList :empty="players.length || failed ? null : 'Personne n\'a quitté la page en jeu.'" class="mt-6">
      <li
        v-for="player in players"
        :key="player.userId"
        class="flex items-center justify-between px-4 py-3 text-sm"
      >
        <span>{{ player.username }}</span>
        <span class="text-slate-500">
          {{ player.losses }} — dernière le {{ formatDay(player.lastAt) }}
        </span>
      </li>
    </BaseList>
  </BaseSection>
</template>

<script setup lang="ts">
// Les flags de triche, visibles ici et nulle part ailleurs : le joueur n'en
// voit aucune trace. Voir specs/anti-triche.md#flags-côté-admin.
const { players, failed, loading } = await useAdminFocusLosses()
</script>
