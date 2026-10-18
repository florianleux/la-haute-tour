<template>
  <PlayFrame
    skin="recovery"
    :motion="motion"
  >
    <template #medallion>
      <PlayText
        v-if="screen.question"
        role="timer"
        as="span"
        class="text-amber-600"
      >
        {{ secondsLeft }}
      </PlayText>
      <VerdictMark
        v-else-if="screen.verdict"
        :correct="screen.verdict.correct"
      />
    </template>

    <template v-if="screen.question">
      <!-- Ce que les rubans disent en ascension, dit ici en une ligne : le
           parchemin n'en dessine pas. Le joueur compte ses questions. Épinglée
           en haut du panneau, sous le médaillon, pour que la question reste
           centrée comme celle de l'ascension.

           Sur la question seulement : un décompte sert à savoir où l'on en est
           de ce qu'on joue. Le verdict, lui, dit déjà ce qu'il advient — et
           l'ascension n'affiche aucun compteur sur le sien. -->
      <PlayText
        v-if="screen.recovery"
        role="progress"
        class="absolute top-[5%] inset-x-0 text-amber-900/60"
      >
        <!-- Deux lignes en mobile : d'une traite, elle en prendrait trois et
             mordrait sur la question. -->
        Question {{ screen.recovery.position }}/{{ screen.recovery.total }}<span class="max-sm:hidden"> · </span><br class="sm:hidden">{{ score }}
      </PlayText>

      <PlayText
        role="statement"
        class="text-amber-800"
      >
        {{ statement }}
      </PlayText>

      <BaseParchmentInput
        :model-value="modelValue"
        @update:model-value="$emit('update:modelValue', $event)"
        @submit="send('enter')"
      />

      <EmptyAnswerNotice :method="heldEmptySend" />
    </template>

    <template v-else-if="screen.verdict">
      <VerdictLines
        :verdict="screen.verdict"
        :disputable="disputable"
        :disputing="disputing"
        @dispute="$emit('dispute')"
      />

      <!-- Le sort du rattrapage s'annonce sur le verdict de la question qui le
           scelle. Voir specs/ecrans.md#recovery--rattrapage. -->
      <PlayText
        v-if="screen.recovery && screen.recovery.resumes !== null"
        role="notice"
        :class="screen.recovery.resumes ? 'text-emerald-700' : 'text-amber-700'"
      >
        {{ screen.recovery.resumes
          ? RECOVERY_SUCCESS_MESSAGE
          : RECOVERY_FAILURE_MESSAGE }}
      </PlayText>
    </template>

    <template #action>
      <BaseCardButton
        v-if="screen.question"
        label="Valider"
        anchor="parchment-bottom"
        face="plank"
        :loading="submitting"
        @click="send('click')"
      />
      <BaseCardButton
        v-else-if="action"
        :label="action.label"
        anchor="parchment-bottom"
        face="plank"
        :loading="advancing"
        @click="$emit('advance')"
      />
    </template>
  </PlayFrame>
</template>

<script setup lang="ts">
// L'écran de rattrapage — la question et son verdict. Miroir de l'ascension :
// même PlayFrame, mêmes rôles de texte, mêmes gestes ; seules changent les
// images et la place qu'elles laissent, parce qu'on rattrape au camp et non
// dans la tour. Voir specs/ecrans.md#recovery--rattrapage.
//
// Un seul composant là où l'ascension en a deux : ResultCard porte le verdict
// plus le palier, la fin de partie, le coffre et les rubans, dont le rattrapage
// n'a rien — pas de coffre (isLootQuestion rend false en rattrapage), pas de
// palier, pas de vie perdue. Ce qui reste tient dans un fichier.
import type { GameScreen, PlayAction } from '~~/utils/phase'
import { RECOVERY_FAILURE_MESSAGE, RECOVERY_SUCCESS_MESSAGE } from '~~/utils/phase'
import type { SendMethod } from '~/composables/useEmptyAnswerHold'

const props = defineProps<{
  screen: GameScreen
  /** Le bouton qui avance — libellé et geste —, null pendant une question. Voir utils/phase.ts (playView). */
  action: PlayAction | null
  modelValue: string
  secondsLeft: number | null
  submitting: boolean
  disputable: boolean
  disputing: boolean
  advancing: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [string]
  'submit': []
  'dispute': []
  'advance': []
}>()

// Une réponse vide attend d'être confirmée, comme en ascension (QuestionCard).
// La carte reste montée de la question au verdict : la retenue suit la question.
const { heldEmptySend, holds } = useEmptyAnswerHold(() => props.modelValue, () => props.screen.question?.id)

function send(method: SendMethod): void {
  if (props.submitting || !holds(method)) {
    emit('submit')
  }
}

// « Question 3/5 · 2 réponses justes sur 3 requises » : où il en est, ce qu'il a,
// ce qu'il lui faut. Le pluriel suit chaque nombre, zéro compris au singulier.
const score = computed(() => {
  const line = props.screen.recovery
  if (!line) {
    return ''
  }
  const s = (n: number): string => (n > 1 ? 's' : '')
  return `${line.successes} réponse${s(line.successes)} juste${s(line.successes)} sur ${line.required} requise${s(line.required)}`
})

// Les mêmes attentes qu'en ascension : la réponse se fait juger, le verdict s'en va.
const motion = computed(() => {
  if (props.screen.question) {
    return props.submitting ? 'judging' : undefined
  }
  return props.advancing ? 'leaving' : undefined
})

const statement = computed(() =>
  withNonBreakingSpaces(props.screen.question?.statement ?? ''),
)
</script>
