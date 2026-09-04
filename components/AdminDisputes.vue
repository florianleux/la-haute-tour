<script setup lang="ts">
import type { DisputeVerdict } from '~~/server/utils/disputes'

// La file d'arbitrage, en tête du dashboard : l'admin la voit dès sa connexion.
// Voir specs/admin.md#notification-des-contestations.
const { disputes, failed, loading, settling, settle } = await useAdminDisputes()

const settleFailed = ref(false)

async function decide(id: number, verdict: DisputeVerdict): Promise<void> {
  settleFailed.value = !(await settle(id, verdict))
}
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

    <BaseLoading v-if="loading" class="mt-6">
      Mise à jour de la file…
    </BaseLoading>

    <BaseList :empty="disputes.length || failed ? null : 'Aucune contestation en attente.'" class="mt-6">
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
          <BaseButton :loading="settling" @click="decide(dispute.id, 'accepted')">
            Accepter
          </BaseButton>
          <BaseButton variant="ghost" :loading="settling" @click="decide(dispute.id, 'rejected')">
            Rejeter
          </BaseButton>
        </div>
      </li>
    </BaseList>
  </BaseSection>
</template>
