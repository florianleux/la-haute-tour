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
      :class="[entry.correct ? 'text-emerald-700' : 'text-rose-700', shade]"
    >
      {{ entry.correct ? 'Connue' : 'À revoir' }}
    </PlayText>

    <!-- À sa leçon, la Boule monte : centrée, elle passerait sous la bulle de
         Michel. -->
    <div class="flex flex-col items-center gap-[2cqw]" :class="!spotlit && 'my-auto'">
      <VerdictLines
        review
        :verdict="verdict"
        :copyable="copyable"
        :disputable="false"
        :disputing="false"
        :shaded="spotlit"
        @copied="$emit('copied', $event)"
      />

      <!-- La Boule de cristal, à part de la réponse, qu'un clic copie avec la
           Plume. -->
      <NuxtLink
        v-if="linked"
        :to="wikipediaUrl(entry.answerLabel)"
        external
        target="_blank"
        aria-label="Voir sur Wikipédia"
        title="Voir sur Wikipédia"
        class="w-[11cqw] transition-[scale,filter] duration-200 ease-out hover:scale-115 hover:brightness-110 focus-visible:scale-115 active:scale-95"
        @click="spotlit && $emit('followed')"
      >
        <img :src="itemLabel('CRYSTAL_BALL').image" alt="" class="w-full drop-shadow-[0_3px_4px_rgb(69_26_3/0.45)]">
      </NuxtLink>

      <PlayText
        v-if="entry.disputeStatus === 'pending'"
        role="notice"
        class="text-amber-700"
        :class="shade"
      >
        Contestation en cours…
      </PlayText>
      <PlayText
        v-else-if="entry.disputeStatus === 'rejected'"
        role="notice"
        class="text-amber-700"
        :class="shade"
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
      :class="shade"
    >
      {{ entry.poolSuccesses }}/{{ poolSuccessesToLeave }} réussite{{ poolSuccessesToLeave > 1 ? 's' : '' }} pour sortir du Pool des Échecs
    </PlayText>

    <!-- Une Sangsue dit ce qu'elle a coûté, avec le Filet à sangsues. -->
    <PlayText
      v-if="entry.leechFailures !== null"
      role="aside"
      class="text-rose-900/80"
      :class="shade"
    >
      Ratée {{ entry.leechFailures }} fois au rattrapage
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
  /** Le joueur porte la Boule de cristal. */
  linked: boolean
  /** Michel montre la Boule, à sa leçon : elle seule reste éclairée. */
  spotlit?: boolean
}>()

defineEmits<{
  copied: [which: 'statement' | 'answer']
  /** La Boule cliquée, à sa leçon. */
  followed: []
}>()

const shade = computed(() => (props.spotlit ? LESSON_SHADE : ''))

// Relue au camp, la question ne coûte aucune vie.
const verdict = computed((): Verdict => ({
  ...props.entry,
  submittedAnswer: props.entry.submittedAnswer ?? '',
  lifeLost: false,
  focusLoss: false,
}))

</script>
