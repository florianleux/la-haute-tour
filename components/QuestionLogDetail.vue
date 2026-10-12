<template>
  <!-- Les lignes du verdict de la Tour : la question se relit comme elle
       s'est jugée. Le panneau qui la porte est un @container, d'où viennent
       les tailles de PlayText ; `zoom` les réduit d'un cinquième — une fiche
       qu'on relit, pas le verdict qu'on reçoit. -->
  <div class="flex flex-col items-center gap-[2cqw] px-[8cqw] text-center [zoom:0.8]">
    <VerdictLines
      review
      :verdict="verdict"
      :disputable="isDisputable(entry.questionId)"
      :disputing="disputingId === entry.questionId"
      @dispute="sendDispute(entry.questionId)"
    />

    <!-- Ce qui reste à faire pour qu'elle quitte le pool : les Réussites se
         lisent sur le seuil, pas seules. -->
    <PlayText
      v-if="entry.poolSuccesses !== null"
      role="aside"
      class="text-amber-800/80"
    >
      À revoir : {{ entry.poolSuccesses }}/{{ poolSuccessesToLeave }} réussite{{ poolSuccessesToLeave > 1 ? 's' : '' }} pour sortir du pool
    </PlayText>

    <PlayText
      v-if="entry.disputeStatus === 'pending'"
      role="notice"
      class="text-amber-700"
    >
      Contestation en cours…
    </PlayText>
    <PlayText
      v-else-if="entry.disputeStatus === 'rejected'"
      role="notice"
      class="text-amber-700"
    >
      Contestation refusée
    </PlayText>
  </div>
</template>

<script setup lang="ts">
// La question choisie dans le Volumen : énoncé, réponse affichée, saisie et
// verdict — fiche de révision, pas punition — et la contestation quand elle est
// encore ouverte. Voir specs/ecrans.md#volumen.
import type { QuestionLogEntryView, Verdict } from '~~/server/utils/game'

const props = defineProps<{
  entry: QuestionLogEntryView
  poolSuccessesToLeave: number
}>()

// Relue au camp, la question ne coûte aucune vie.
const verdict = computed((): Verdict => ({
  ...props.entry,
  submittedAnswer: props.entry.submittedAnswer ?? '',
  lifeLost: false,
}))

// Le serveur seul dit ce qui est contestable : une erreur encore au pool de
// l'étage, pas encore contestée. Voir specs/validation.md#quand. Une fois la
// contestation partie, la liste relit sa page (voir QuestionLogList).
const { isDisputable, sendDispute, disputingId } = useDisputes()
</script>
