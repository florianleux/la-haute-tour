<script setup lang="ts">
import { FLOOR_COUNT } from '~~/shared/utils/floors'

// Le parcours, pas l'état de l'instant : ni phase, ni vies, ni attente — ceux-là
// vivent dans le jeu. Aucun flag de triche non plus : ils sont réservés à
// l'administration. Voir specs/ecrans.md#profil.
const { user } = await useCurrentUser()
const { logout, pending, failed } = useLogout()
const { journey, failed: journeyFailed } = await useJourney()

const memberSince = computed(() => (user.value ? formatDay(user.value.createdAt) : ''))

// Un joueur qui n'a pas encore vu de question n'a pas de parcours : mieux vaut
// le dire qu'aligner des zéros.
const started = computed(() => (journey.value?.seen ?? 0) > 0)

const successRate = computed(() => {
  const stats = journey.value
  if (!stats || stats.seen === 0) {
    return '—'
  }

  return `${Math.round((stats.correct / stats.seen) * 100)} %`
})

/** Une tentative achevée, ou le tiret qui dit qu'il n'y en a pas encore. */
function attemptLength(value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : `${value}`
}
</script>

<template>
  <BaseCard v-if="user" wide title="Profil">
    <template #lead>
      {{ user.username }} — membre depuis le {{ memberSince }}.
    </template>

    <BaseNotice v-if="journeyFailed">
      Impossible de lire ton parcours. Recharge la page.
    </BaseNotice>

    <BaseSection v-else-if="journey" title="Ton parcours" class="mt-8">
      <template #lead>
        Le chemin déjà fait. Où tu en es à l'instant se lit sur l'accueil.
      </template>

      <BaseHint v-if="!started" class="mt-4">
        Ton parcours commencera à ta première question.
      </BaseHint>

      <div v-else class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <BaseStat label="Étage" :value="`${journey.floor} / ${FLOOR_COUNT}`" />
        <BaseStat label="Dans cet étage" :value="`${journey.floorSeen} / ${journey.floorTotal}`" />
        <BaseStat label="Questions vues" :value="journey.seen" />
        <BaseStat label="Bonnes réponses" :value="journey.correct" />
        <BaseStat label="Réussite" :value="successRate" />
        <BaseStat label="Meilleure série" :value="journey.bestStreak" />
        <BaseStat label="Tentatives" :value="journey.attempts" />
        <BaseStat label="Plus longue" :value="attemptLength(journey.longestAttempt)" />
        <BaseStat label="Plus courte" :value="attemptLength(journey.shortestAttempt)" />
      </div>

      <BaseHint v-if="started" class="mt-3">
        <template v-if="journey.attempts === 0">
          Une tentative se compte en questions vues, et ne s'inscrit ici qu'une fois achevée.
        </template>
        <template v-else>
          Les tentatives se comptent en questions vues.
        </template>
        <template v-if="journey.disputes > 0">
          Contestations acceptées : {{ journey.disputesWon }} sur {{ journey.disputes }}.
        </template>
      </BaseHint>
    </BaseSection>

    <BaseButton block class="mt-10" :loading="pending" @click="logout">
      Se déconnecter
    </BaseButton>
    <BaseNotice v-if="failed">
      La déconnexion a échoué. Réessaie.
    </BaseNotice>
  </BaseCard>
</template>
