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
           parchemin n'en dessine pas. Le joueur compte ses questions, et un
           rattrapage rallongé par une Indulgence passe pour un bug sans cette
           mention. Voir specs/bonus.md#catalogue.

           Sur la question seulement : un décompte sert à savoir où l'on en est
           de ce qu'on joue. Le verdict, lui, dit déjà ce qu'il advient — et
           l'ascension n'affiche aucun compteur sur le sien. -->
      <PlayText
        v-if="screen.recovery"
        role="progress"
        class="text-amber-900/60"
      >
        Rattrapage — {{ screen.recovery.position }}/{{ screen.recovery.total }},
        {{ screen.recovery.successes }} juste(s)
        <template v-if="screen.recovery.lengthened">— rallongé par une Indulgence</template>
      </PlayText>

      <PlayText
        role="statement"
        class="text-amber-800"
      >
        {{ statement }}
      </PlayText>

      <PlayInput
        :model-value="modelValue"
        @update:model-value="$emit('update:modelValue', $event)"
        @submit="$emit('submit')"
      />
    </template>

    <template v-else-if="screen.verdict">
      <VerdictLines
        :verdict="screen.verdict"
        :contestable="contestable"
        :contesting="contesting"
        @dispute="$emit('dispute')"
      />

      <!-- Le sort du rattrapage s'annonce sur le verdict de la question qui le
           scelle. Voir specs/ecrans.md#recovery--rattrapage. -->
      <PlayText
        v-if="screen.recovery?.result"
        role="notice"
        :class="screen.recovery.result === 'resumed' ? 'text-emerald-700' : 'text-amber-700'"
      >
        {{ screen.recovery.result === 'resumed'
          ? RECOVERY_SUCCESS_MESSAGE
          : RECOVERY_FAILURE_MESSAGE }}
      </PlayText>
    </template>

    <!-- Ce qui court sur cette tentative. Le sort nommé plutôt qu'EffectPip,
         comme sur l'attente : il n'y a pas de ruban pour les loger ici, et le
         parchemin a la place d'écrire le sort en toutes lettres. -->
    <div
      v-if="screen.activeEffects.length"
      class="flex flex-wrap justify-center gap-[1cqw]"
    >
      <SpellMention
        v-for="(effect, index) in screen.activeEffects"
        :key="index"
        :subject="effect"
        class="text-[2.1cqw]"
      />
    </div>

    <template #action>
      <CardButton
        v-if="screen.question"
        label="Valider"
        anchor="parchment-bottom"
        face="plank"
        :disabled="submitting"
        @click="$emit('submit')"
      />
      <CardButton
        v-else-if="screen.action"
        :label="screen.action"
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
import type { GameScreen } from '~~/utils/phase'
import { RECOVERY_FAILURE_MESSAGE, RECOVERY_SUCCESS_MESSAGE } from '~~/utils/phase'

const props = defineProps<{
  screen: GameScreen
  modelValue: string
  secondsLeft: number | null
  submitting: boolean
  contestable: boolean
  contesting: boolean
  advancing: boolean
}>()

defineEmits<{
  'update:modelValue': [string]
  'submit': []
  'dispute': []
  'advance': []
}>()

const statement = computed(() =>
  withNonBreakingSpaces(props.screen.question?.statement ?? ''),
)
</script>
