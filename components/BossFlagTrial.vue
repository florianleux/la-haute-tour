<template>
  <!-- Le cadre de l'épreuve, son médaillon et son bouton, dessinés pour le
       boss (public/images/boss/1/trial-*.webp). Au milieu : le drapeau, le
       champ, puis le verdict. Tout est en `dvh`, réglé
       sur une fenêtre de 880 px de haut (1dvh = 8,8 px) : le cadre garde sa
       place et sa part de l'écran à toute taille. L'enveloppe, invisible, fait
       101,8dvh (896 px) : le bouton, dimensionné en `cqw`, s'y ancre.
       Les gestes sont ceux de l'ascension (PlayFrame) : à l'arrivée, le cadre
       tombe, le médaillon et le bouton suivent (`data-arriving`) ; il saute de
       joie sur le juste, encaisse un coup sur le faux (`reaction`). -->
  <div
    class="group fixed left-1/2 top-[14dvh] z-10 w-[101.8dvh] -translate-x-1/2 @container text-center"
    :class="reaction"
    :data-arriving="arriving || undefined"
  >
    <!-- Le cadre visible (638×795) : 49,2dvh de large, la hauteur de l'ancien
         cadre provisoire (61,3dvh). Ses textes, en `cqw`, se règlent sur lui,
         bordure dorée déduite (2,5 % de chaque côté). Le drapeau y fait 39dvh. -->
    <div
      class="relative mx-auto aspect-638/795 w-[49.2dvh] origin-bottom bg-[url(/images/boss/1/trial-frame.webp)] bg-contain bg-center bg-no-repeat @container group-data-arriving:motion-safe:animate-drop-in"
      :class="lift"
    >
      <!-- Le médaillon aux deux lunes, à cheval sur le bord haut, dans les
           proportions de son dessin (378 px pour un cadre de 638) : chrono, puis
           juste/faux, au centre du grand disque (45 % de sa hauteur). -->
      <PlayMedallion
        ratio="378 / 216"
        ink="top-[45%] text-[17cqw]"
        class="top-0 w-[29.1dvh] bg-[url(/images/boss/1/trial-timer.webp)] group-data-arriving:motion-safe:animate-medallion-drop [--enter-delay:0.3s]"
        :class="motion && CARD_MOTIONS[motion].medallion"
      >
        <PlayText
          v-if="verdict === null"
          role="timer"
          as="span"
          :class="MOON_INK.navy"
        >
          {{ secondsLeft }}
        </PlayText>
        <VerdictMark
          v-else
          :correct="verdict.correct"
        />
      </PlayMedallion>

      <!-- Le panneau : l'encre remonte au jugement, le verdict glisse et
           s'efface sur « Suivant » (`motion`). -->
      <div
        class="flex h-full flex-col items-center justify-center gap-[1.8dvh] px-[2.5dvh]"
        :class="motion && CARD_MOTIONS[motion].panel"
      >
      <template v-if="verdict === null">
        <!-- Les drapeaux en `drop-shadow`, pas en `box-shadow` : dix sont
             détourés (transparence), et l'ombre doit suivre leur contour, pas
             leur boîte. Le cadre grossit (chute, saut) : à vérifier sur iPad
             (CLAUDE.md, Styling). -->
        <img
          :src="`/images/boss/1/flags/${image}.webp`"
          alt="Le drapeau à reconnaître"
          class="aspect-2/1 w-[39dvh] object-contain drop-shadow-md"
        >
        <BaseParchmentInput
          :key="image"
          :model-value="modelValue"
          tone="moon"
          @update:model-value="emit('update:modelValue', $event)"
          @submit="send('enter')"
        />

        <EmptyAnswerNotice :method="heldEmptySend" />
      </template>

      <template v-else>
        <!-- Les lignes du verdict, 20 % plus grandes que celles d'une
             question : la carte du boss est plus étroite. -->
        <VerdictHeadline
          :cheer="headline.cheer"
          large
          :class="headline.ink"
        >
          {{ headline.text }}
        </VerdictHeadline>
        <!-- Le drapeau rappelé, comme l'énoncé au verdict d'une question
             (VerdictLines) : plus petit, pour laisser la place à la réponse. -->
        <img
          :src="`/images/boss/1/flags/${image}.webp`"
          alt="Le drapeau de l'épreuve"
          class="aspect-2/1 w-[24dvh] object-contain drop-shadow-md"
        >
        <PlayText
          role="answer"
          large
          :class="MOON_INK.teal"
        >
          {{ answer?.name }}
        </PlayText>
        <!-- Ce qui situe le drapeau, plus petit, à la ligne (splitFlagLabel) :
             collé au nom, sous l'écart des autres lignes de la carte. -->
        <PlayText
          v-if="answer?.detail"
          role="detail"
          large
          class="-mt-[1.4dvh]"
          :class="MOON_INK.tealSoft"
        >
          {{ answer?.detail }}
        </PlayText>
        <!-- Comme au verdict d'une question (VerdictLines). -->
        <PlayText
          role="aside"
          large
          :class="MOON_INK.tealSoft"
        >
          Ta réponse : {{ verdict.submittedAnswer || '(rien)' }}
        </PlayText>
      </template>
      </div>
    </div>

    <BaseCardButton
      v-if="verdict === null || actionLabel"
      :label="verdict === null ? 'Valider' : actionLabel!"
      :loading="busy"
      anchor="image-bottom"
      face="moon"
      @click="verdict === null ? send('click') : emit('advance')"
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
import { MOON_INK } from '~~/utils/typography'
import type { SendMethod } from '~/composables/useEmptyAnswerHold'
import { CARD_MOTIONS, CARD_REACTIONS } from '~/composables/useCardMotion'
import type { CardMotion } from '~/composables/useCardMotion'
import type { BossOutcome } from '~~/server/utils/mechanics'

const props = defineProps<{
  /** Le nom opaque du drapeau, sous public/images/boss/1/flags/. */
  image: string
  secondsLeft: number | null
  /** Null tant que le drapeau attend sa réponse. */
  verdict: Pick<BossVerdict, 'correct' | 'answerLabel' | 'submittedAnswer'> | null
  /**
   * Le terme du combat, que le verdict annonce à la place de juste ou faux. La
   * défaite, elle, garde le verdict ordinaire : son outro (BossOutro) suit.
   */
  outcome: BossOutcome | null
  modelValue: string
  /** Le bouton sous le verdict ; absent, aucun. Sous le drapeau, c'est « Valider ». */
  actionLabel: string | null
  busy?: boolean
  /** L'attente d'un geste, comme sur PlayFrame : `judging` sur Valider, `leaving` sur Suivant. */
  motion?: CardMotion
}>()

const emit = defineEmits<{ 'update:modelValue': [value: string], 'submit': [], 'advance': [] }>()

// Une réponse vide attend d'être confirmée, comme à l'ascension (QuestionCard).
const { heldEmptySend, holds } = useEmptyAnswerHold(() => props.modelValue, () => props.image)

function send(method: SendMethod): void {
  if (props.busy || !holds(method)) {
    emit('submit')
  }
}

const answer = computed(() => (props.verdict ? splitFlagLabel(props.verdict.answerLabel) : null))

const headline = computed(() => {
  if (props.outcome === 'victory') {
    return { text: 'Victoire !', ink: 'text-emerald-700', cheer: true }
  }
  if (props.outcome === 'passed') {
    return { text: 'Le boss te laisse passer', ink: 'text-amber-700', cheer: false }
  }
  return props.verdict?.correct
    ? { text: 'Correct !', ink: 'text-emerald-700', cheer: true }
    : { text: 'Incorrect...', ink: 'text-rose-700', cheer: false }
})

/** Le cadre saute de joie sur le juste, encaisse un coup sur le faux. */
const reaction = computed(() => {
  if (!props.verdict) {
    return ''
  }
  return CARD_REACTIONS[props.verdict.correct ? 'hop' : 'hit']
})

// Les gestes de l'ascension (useCardMotion) : il tombe à l'arrivée, monte au
// jugement et retombe au verdict.
const { arriving, lift } = useCardMotion(() => props.motion, { arriving: true, settling: false })
</script>
