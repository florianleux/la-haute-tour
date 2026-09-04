<script setup lang="ts">
import type { DisputeVerdict } from '~~/server/utils/disputes'

// La file d'arbitrage, en tête du dashboard : l'admin la voit dès sa connexion.
// Voir specs/admin.md#notification-des-contestations.
const { disputes, failed, loading, settle } = await useAdminDisputes()

const settleFailed = ref(false)
// Le bouton exact sur lequel on vient de cliquer : lui seul montre son loader,
// sinon toute la file se met à tourner pour un seul arbitrage.
const deciding = ref<string | null>(null)

function isDeciding(id: number, verdict: DisputeVerdict): boolean {
  return deciding.value === `${id}:${verdict}`
}

async function decide(id: number, verdict: DisputeVerdict): Promise<void> {
  deciding.value = `${id}:${verdict}`
  settleFailed.value = !(await settle(id, verdict))
  deciding.value = null
}

// La première lecture n'a encore rien à montrer : on montre la forme de la file.
// Une relecture garde la file en place — le bouton cliqué porte son loader.
const firstLoad = computed(() => loading.value && disputes.value.length === 0)
const SKELETONS = 3

const empty = computed(
  () => (disputes.value.length || failed.value || firstLoad.value
    ? null
    : 'Aucune contestation en attente.'),
)
</script>

<template>
  <BaseSection title="Contestations">
    <template #lead>
      Accepter, c'est établir que le joueur avait raison : sa réponse rejoint les
      réponses acceptées pour tout le monde, son verdict est corrigé et une vie lui revient.
    </template>

    <BaseNotice v-if="settleFailed">
      L'arbitrage a échoué. Réessaie.
    </BaseNotice>
    <BaseNotice v-if="failed">
      Impossible de lire les contestations. Recharge la page.
    </BaseNotice>

    <BaseList :empty="empty" class="mt-6">
      <li
        v-for="index in (firstLoad ? SKELETONS : 0)"
        :key="`skeleton-${index}`"
        class="space-y-2 px-4 py-3"
      >
        <BaseSkeleton height="h-4" width="w-2/3" />
        <BaseSkeleton height="h-3" width="w-1/2" />
        <BaseSkeleton height="h-3" width="w-3/5" />
      </li>

      <li
        v-for="dispute in disputes"
        :key="dispute.id"
        class="flex items-start justify-between gap-4 px-4 py-3 text-sm"
      >
        <div>
          <p class="font-medium text-slate-100">
            {{ dispute.statement }}
          </p>
          <BaseHint class="mt-1">
            {{ dispute.username }} a répondu « {{ dispute.submittedAnswer }} »
          </BaseHint>
          <BaseHint class="mt-1">
            Acceptées : {{ dispute.acceptedAnswers.join(' · ') || 'aucune' }} — affichée :
            <AnswerLabel :label="dispute.answerLabel" />
          </BaseHint>
        </div>

        <div class="flex shrink-0 gap-2">
          <BaseButton
            :loading="isDeciding(dispute.id, 'accepted')"
            :disabled="Boolean(deciding)"
            @click="decide(dispute.id, 'accepted')"
          >
            Accepter
          </BaseButton>
          <BaseButton
            variant="ghost"
            :loading="isDeciding(dispute.id, 'rejected')"
            :disabled="Boolean(deciding)"
            @click="decide(dispute.id, 'rejected')"
          >
            Rejeter
          </BaseButton>
        </div>
      </li>
    </BaseList>
  </BaseSection>
</template>
