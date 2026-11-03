<template>
  <!-- Les lignes du verdict de la Tour : la question se relit comme elle
       s'est jugée. Le panneau qui la porte est un @container, d'où viennent
       les tailles de PlayText ; `zoom` les réduit d'un cinquième — une fiche
       qu'on relit, pas le verdict qu'on reçoit. -->
  <!-- Le titre en tête et le seuil du pool en pied, quelle que soit la taille
       de la question ; le reste se centre entre les deux. -->
  <div class="flex flex-col items-center gap-[2cqw] px-[8cqw] text-center [zoom:0.8]">
    <PlayText
      role="headline"
      :class="entry.correct ? 'text-emerald-700' : 'text-rose-700'"
    >
      {{ entry.correct ? 'Connue' : 'À revoir' }}
    </PlayText>

    <div class="my-auto flex flex-col items-center gap-[2cqw]">
      <VerdictLines
        review
        :verdict="verdict"
        :copyable="copyable"
        :disputable="false"
        :disputing="false"
        @copied="$emit('copied', $event)"
      />

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

    <!-- Ce qui reste à faire pour qu'elle quitte le pool : les Réussites se
         lisent sur le seuil, pas seules. -->
    <PlayText
      v-if="entry.poolSuccesses !== null"
      role="aside"
      class="text-amber-800/80"
    >
      {{ entry.poolSuccesses }}/{{ poolSuccessesToLeave }} réussite{{ poolSuccessesToLeave > 1 ? 's' : '' }} pour sortir du Pool des Échecs
    </PlayText>
  </div>
</template>

<script setup lang="ts">
// La question choisie dans le Volumen : énoncé, réponse affichée, saisie et
// verdict — fiche de révision, pas punition — et où en est sa contestation. Voir specs/ecrans.md#volumen.
import type { QuestionLogEntryView, Verdict } from '~~/server/utils/game'

const props = defineProps<{
  entry: QuestionLogEntryView
  poolSuccessesToLeave: number
  /** Le joueur porte la Plume de copiste. */
  copyable: boolean
}>()

defineEmits<{ copied: [which: 'statement' | 'answer'] }>()

// Relue au camp, la question ne coûte aucune vie.
const verdict = computed((): Verdict => ({
  ...props.entry,
  submittedAnswer: props.entry.submittedAnswer ?? '',
  lifeLost: false,
  focusLoss: false,
}))

</script>
