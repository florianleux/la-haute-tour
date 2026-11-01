<template>
  <!-- Le cadre de l'épreuve, son médaillon et son bouton, dessinés pour le
       boss (public/images/boss/1/trial-*.webp). Au milieu : le drapeau, le
       champ, puis le verdict. Tout est en `dvh`, réglé
       sur une fenêtre de 880 px de haut (1dvh = 8,8 px) : le cadre garde sa
       place et sa part de l'écran à toute taille. L'enveloppe, invisible, fait
       101,8dvh (896 px) : le bouton, dimensionné en `cqw`, s'y ancre. -->
  <div class="fixed left-1/2 top-[14dvh] z-10 w-[101.8dvh] -translate-x-1/2 @container text-center">
    <!-- Le cadre visible (638×795) : 49,2dvh de large, la hauteur de l'ancien
         cadre provisoire (61,3dvh). Ses textes, en `cqw`, se règlent sur lui,
         bordure dorée déduite (2,5 % de chaque côté). Le drapeau y fait 39dvh. -->
    <div class="relative mx-auto flex aspect-638/795 w-[49.2dvh] flex-col items-center justify-center gap-[1.8dvh] bg-[url(/images/boss/1/trial-frame.webp)] bg-contain bg-center bg-no-repeat px-[2.5dvh] @container">
      <!-- Le médaillon aux deux lunes, à cheval sur le bord haut, dans les
           proportions de son dessin (378 px pour un cadre de 638) : chrono, puis
           juste/faux, au centre du grand disque (45 % de sa hauteur). -->
      <PlayMedallion
        ratio="378 / 216"
        ink="top-[45%] text-[17cqw]"
        class="top-0 w-[29.1dvh] bg-[url(/images/boss/1/trial-timer.webp)]"
      >
        <PlayText
          v-if="verdict === null"
          role="timer"
          as="span"
          class="text-amber-600"
        >
          {{ secondsLeft }}
        </PlayText>
        <VerdictMark
          v-else
          :correct="verdict.correct"
        />
      </PlayMedallion>

      <template v-if="verdict === null">
        <img
          :src="`/images/boss/1/flags/${image}.webp`"
          alt="Le drapeau à reconnaître"
          class="aspect-2/1 w-[39dvh] object-contain drop-shadow-md"
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
        <!-- Comme au verdict d'une question (VerdictLines). -->
        <PlayText
          role="aside"
          class="text-amber-800/80"
        >
          Ta réponse : {{ verdict.submittedAnswer || '(rien)' }}
        </PlayText>
      </template>
    </div>

    <BaseCardButton
      v-if="verdict === null || actionLabel"
      :label="verdict === null ? 'Valider' : actionLabel!"
      :loading="busy"
      anchor="image-bottom"
      face="moon"
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
  verdict: Pick<BossVerdict, 'correct' | 'answerLabel' | 'submittedAnswer'> | null
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
