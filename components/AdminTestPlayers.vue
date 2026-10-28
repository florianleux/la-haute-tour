<template>
  <BaseSection title="Joueurs test">
    <template #lead>
      Des joueurs sans compte Discord, que tu peux incarner depuis le sélecteur
      du haut. Ils jouent une vraie partie, scellée des vrais joueurs.
    </template>

    <template #aside>
      <BaseButton :loading="acting" @click="act(create)">
        Créer un joueur test
      </BaseButton>
    </template>

    <BaseNotice v-if="actionFailed">
      L'action a échoué. Réessaie.
    </BaseNotice>
    <BaseNotice v-if="failed">
      Impossible de lire les joueurs test. Recharge la page.
    </BaseNotice>

    <BaseEmpty v-if="emptyMessage" class="mt-6">
      {{ emptyMessage }}
    </BaseEmpty>

    <div class="mt-6 space-y-4">
      <AdminTestPlayerCard
        v-for="testPlayer in testPlayers"
        :key="testPlayer.userId"
        :test-player="testPlayer"
        :busy="acting"
        :now="now"
        @set-team="(team: TeamId | null) => act(() => setTeam(testPlayer.userId, team))"
        @grant-spell="(spell: SpellId) => act(() => grantSpell(testPlayer.userId, spell))"
        @advance="(count: number, correct: boolean) => act(() => advance(testPlayer.userId, count, correct))"
        @rewind="(count: number) => act(() => rewind(testPlayer.userId, count))"
        @send-to-cooldown="act(() => sendToCooldown(testPlayer.userId))"
        @skip-cooldown="act(() => skipCooldown(testPlayer.userId))"
        @grant-life="act(() => grantLife(testPlayer.userId))"
        @grant-key="act(() => grantKey(testPlayer.userId))"
        @reset="act(() => reset(testPlayer.userId))"
        @remove="act(() => remove(testPlayer.userId))"
      />
    </div>
  </BaseSection>
</template>

<script setup lang="ts">
// Les joueurs test : les créer, les régler, les supprimer. Un monde à part des
// vraies parties — l'onglet Joueurs n'en montre aucun.
// Voir specs/admin.md#joueurs-test.
import type { SpellId } from '~~/shared/utils/spells'
import type { TeamId } from '~~/shared/utils/teams'

const {
  testPlayers,
  failed,
  loading,
  acting,
  create,
  remove,
  grantSpell,
  advance,
  rewind,
  sendToCooldown,
  skipCooldown,
  grantLife,
  grantKey,
  setTeam,
  reset,
} = await useAdminTestPlayers()

const actionFailed = ref(false)

const now = useClockTick()

// Pas de « aucun » quand la lecture a échoué ou n'est pas finie : ce serait la
// même phrase pour « aucun joueur test » et « je ne sais pas ».
const firstLoad = computed(() => loading.value && testPlayers.value.length === 0)
const emptyMessage = computed(
  () => (testPlayers.value.length || failed.value || firstLoad.value
    ? null
    : 'Aucun joueur test. Crées-en un pour éprouver le jeu de son point de vue.'),
)

async function act(move: () => Promise<boolean>): Promise<void> {
  actionFailed.value = !await move()
}
</script>
