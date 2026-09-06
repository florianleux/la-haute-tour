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

    <BaseEmpty v-if="emptyMessage" class="mt-6">
      {{ emptyMessage }}
    </BaseEmpty>

    <div class="mt-6 grid gap-4 sm:grid-cols-2">
      <AdminPlayerCardSkeleton v-for="index in (firstLoad ? SKELETONS : 0)" :key="`skeleton-${index}`" />
      <AdminPlayerCard
        v-for="player in players"
        :key="player.userId"
        :player="player"
        :busy="acting"
        :running="runningOn(player.userId)"
        :now="now"
        @skip-cooldown="act('skipCooldown', player.userId)"
        @grant-life="act('grantLife', player.userId)"
        @set-team="(team: TeamId | null) => onTeam(player.userId, team)"
      />
    </div>
  </BaseSection>
</template>

<script setup lang="ts">
// Les fiches joueurs. Lecture sans effet : ouvrir l'onglet ne fait avancer
// aucune partie. Voir specs/admin.md#gestion-des-joueurs.
import type { TeamId } from '~~/shared/utils/teams'

const { players, failed, loading, acting, skipCooldown, grantLife, setTeam } = await useAdminPlayers()

const actionFailed = ref(false)

const now = useClockTick()

// La première lecture n'a encore aucune fiche à montrer : on montre leur forme.
// Une relecture, elle, garde les fiches à l'écran — le bouton cliqué porte déjà
// son propre loader.
const firstLoad = computed(() => loading.value && players.value.length === 0)
const SKELETONS = 4

// Pas de « personne » quand la lecture a échoué ou n'est pas finie : ce serait la
// même phrase pour « aucun joueur » et « je ne sais pas ».
const emptyMessage = computed(
  () => (players.value.length || failed.value || firstLoad.value
    ? null
    : 'Aucun joueur inscrit pour l\'instant.'),
)

type PlayerAction = 'skipCooldown' | 'grantLife'

/** Le bouton exact sur lequel on vient de cliquer : lui seul montre son loader. */
const running = ref<{ userId: number, action: PlayerAction } | null>(null)

function runningOn(userId: number): PlayerAction | null {
  return running.value?.userId === userId ? running.value.action : null
}

/** L'équipe n'a pas de bouton dédié : le select porte le geste. */
async function onTeam(userId: number, team: TeamId | null): Promise<void> {
  actionFailed.value = !await setTeam(userId, team)
}

async function act(action: PlayerAction, userId: number): Promise<void> {
  running.value = { userId, action }
  actionFailed.value = !await (action === 'skipCooldown' ? skipCooldown(userId) : grantLife(userId))
  running.value = null
}
</script>
