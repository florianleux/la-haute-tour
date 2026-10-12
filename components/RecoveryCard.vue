<template>
  <PlayFrame skin="recovery">
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
        @submit="$emit('submit')"
      />
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
        :disabled="submitting"
        @click="$emit('submit')"
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

defineEmits<{
  'update:modelValue': [string]
  'submit': []
  'dispute': []
  'advance': []
}>()

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

const statement = computed(() =>
  withNonBreakingSpaces(props.screen.question?.statement ?? ''),
)
</script>
