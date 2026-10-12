<template>
  <li class="flex items-start justify-between gap-4 px-4 py-3">
    <div class="min-w-0 flex-1">
      <p class="text-sm">
        {{ entry.statement }}
      </p>
      <BaseHint class="mt-1 font-bold" tone="success">
        {{ entry.answerLabel }}
      </BaseHint>
      <BaseHint class="mt-1">
        Ta réponse : {{ entry.submittedAnswer || '—' }}
      </BaseHint>
      <BaseHint class="mt-1" :tone="entry.correct ? 'success' : 'danger'">
        {{ entry.correct ? 'Juste' : 'Fausse' }}
      </BaseHint>
      <!-- Ce qui reste à faire pour qu'elle quitte le pool : les Réussites se
           lisent sur le seuil, pas seules. -->
      <BaseHint v-if="entry.poolSuccesses !== null" class="mt-1">
        À revoir : {{ entry.poolSuccesses }}/{{ poolSuccessesToLeave }} réussite{{ poolSuccessesToLeave > 1 ? 's' : '' }} pour sortir du pool
      </BaseHint>
    </div>

    <div class="flex shrink-0 items-center gap-2">
      <template v-if="disputingId === entry.questionId || entry.disputeStatus === 'pending'">
        <BaseSpinner />
        <BaseHint>Contestation en cours…</BaseHint>
      </template>

      <BaseHint v-else-if="entry.disputeStatus === 'rejected'" tone="warning">
        Contestation refusée
      </BaseHint>

      <!-- Le serveur seul dit ce qui est contestable : une erreur encore au
           pool de l'étage, pas encore contestée. Voir specs/validation.md#quand. -->
      <BaseIconButton
        v-else-if="isDisputable(entry.questionId)"
        label="Contester cette question"
        @click="sendDispute(entry.questionId)"
      >
        <path
          d="M3 10v4a1 1 0 0 0 1 1h2l4 4V5L6 9H4a1 1 0 0 0-1 1Zm10.5-4.5a1 1 0 0 0-1.4 0l-.6.6a1 1 0 0 0 0 1.4 5 5 0 0 1 0 7l.6.6a1 1 0 0 0 1.4 0l.6-.6a1 1 0 0 0 0-1.4 3 3 0 0 1 0-4.2l-.6-.6a1 1 0 0 0 0-1.4Z"
        />
      </BaseIconButton>
    </div>
  </li>
</template>

<script setup lang="ts">
// Une question vue, dans le Volumen : la réponse est montrée — fiche de
// révision, pas punition — et la contestation se fait d'ici quand elle est
// encore ouverte. Voir specs/ecrans.md#volumen.
import type { QuestionLogEntryView } from '~~/server/utils/game'

defineProps<{
  entry: QuestionLogEntryView
  poolSuccessesToLeave: number
}>()

// Le statut vient du serveur : une fois la contestation partie, la liste relit
// sa page (voir QuestionLogList).
const { isDisputable, sendDispute, disputingId } = useDisputes()
</script>
