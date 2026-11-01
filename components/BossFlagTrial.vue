<template>
  <!-- ponytail: cadre provisoire, en attendant son dessin. Au milieu : le
       chrono, le drapeau, le champ, puis le verdict. Tout est en `dvh`, réglé
       sur une fenêtre de 880 px de haut (1dvh = 8,8 px) : le cadre garde sa
       place et sa part de l'écran à toute taille. L'enveloppe, invisible, fait
       101,8dvh (896 px) : le bouton, dimensionné en `cqw`, s'y ancre. -->
  <div class="fixed left-1/2 top-[14dvh] z-10 w-[101.8dvh] -translate-x-1/2 @container text-center">
    <!-- Le cadre visible, en portrait 8:9 : 54,5dvh de large, soit 480×540 px.
         Ses textes, en `cqw`, se règlent sur lui, marges de 0,9dvh déduites
         (464 px). Le drapeau y fait 43,3dvh (381 px). Le vide en haut et en
         bas attend le chrono rond et un message. -->
    <div class="mx-auto flex aspect-8/9 w-[54.5dvh] flex-col items-center justify-center gap-[1.8dvh] rounded-[1.8dvh] bg-amber-100 px-[0.9dvh] @container">
      <PlayText
        v-if="verdict === null"
        role="timer"
        as="span"
        class="text-[4cqw] text-amber-600"
      >
        {{ secondsLeft }}
      </PlayText>
      <VerdictMark
        v-else
        :correct="verdict.correct"
      />

      <template v-if="verdict === null">
        <img
          :src="`/images/boss/1/flags/${image}.webp`"
          alt="Le drapeau à reconnaître"
          class="aspect-2/1 w-[43.3dvh] object-contain drop-shadow-md"
        >
        <BaseParchmentInput
          :key="image"
          :model-value="modelValue"
          @update:model-value="emit('update:modelValue', $event)"
          @submit="emit('submit')"
        />
      </template>

      <template v-else>
        <PlayText
          role="headline"
          :class="headline.ink"
        >
          {{ headline.text }}
        </PlayText>
        <PlayText
          role="answer"
          class="text-amber-800"
        >
          {{ answer?.name }}
        </PlayText>
        <!-- Ce qui situe le drapeau, plus petit, à la ligne (splitFlagLabel) :
             collé au nom, sous l'écart des autres lignes de la carte. -->
        <PlayText
          v-if="answer?.detail"
          role="aside"
          class="-mt-[1.4dvh] text-amber-800/80 sm:text-[3.2cqw]"
        >
          {{ answer?.detail }}
        </PlayText>
      </template>
    </div>

    <BaseCardButton
      v-if="verdict === null || actionLabel"
      :label="verdict === null ? 'Valider' : actionLabel!"
      :loading="busy"
      anchor="image-bottom"
      @click="verdict === null ? emit('submit') : emit('advance')"
    />
  </div>
</template>

<script setup lang="ts">
// L'épreuve du boss de l'étage 1 : un drapeau, sa saisie, son verdict. Posée
// au milieu de l'arène (BossArena), en jeu (BossFightCard) comme sur le banc
// (pages/test/boss/1.vue). Elle ne juge rien : le verdict vient de l'appelant.
// Voir specs/boss-etage1-drapeaux.md.
import type { BossVerdict } from '~~/server/utils/boss'
import { splitFlagLabel } from '~~/utils/flagLabel'
import type { BossOutcome } from '~~/server/utils/mechanics'

const props = defineProps<{
  /** Le nom opaque du drapeau, sous public/images/boss/1/flags/. */
  image: string
  secondsLeft: number | null
  /** Null tant que le drapeau attend sa réponse. */
  verdict: Pick<BossVerdict, 'correct' | 'answerLabel'> | null
  /** Le terme du combat, que le verdict annonce à la place de juste ou faux. */
  outcome: BossOutcome | null
  modelValue: string
  /** Le bouton sous le verdict ; absent, aucun. Sous le drapeau, c'est « Valider ». */
  actionLabel: string | null
  busy?: boolean
}>()

const emit = defineEmits<{ 'update:modelValue': [value: string], 'submit': [], 'advance': [] }>()

const answer = computed(() => (props.verdict ? splitFlagLabel(props.verdict.answerLabel) : null))

const headline = computed(() => {
  if (props.outcome === 'victory') {
    return { text: 'Victoire !', ink: 'text-emerald-700' }
  }
  if (props.outcome === 'passed') {
    return { text: 'Le boss te laisse passer', ink: 'text-amber-700' }
  }
  if (props.outcome === 'defeat') {
    return { text: 'Défaite...', ink: 'text-rose-700' }
  }
  return props.verdict?.correct
    ? { text: 'Correct !', ink: 'text-emerald-700' }
    : { text: 'Incorrect...', ink: 'text-rose-700' }
})
</script>
