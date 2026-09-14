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
      <PlayText
        v-else-if="screen.verdict"
        role="mark"
        as="span"
        :class="screen.verdict.correct ? 'text-emerald-600' : 'text-rose-600'"
      >
        {{ screen.verdict.correct ? '✓' : '✗' }}
      </PlayText>
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
      <PlayText
        role="headline"
        :class="screen.verdict.correct ? 'text-emerald-700' : 'text-rose-700'"
      >
        {{ screen.verdict.correct ? 'Correct !' : 'Incorrect...' }}
      </PlayText>

      <PlayText
        role="recall"
        class="text-amber-800"
      >
        {{ statement }}
      </PlayText>

      <PlayText
        role="answer"
        class="text-amber-800"
      >
        {{ screen.verdict.answerLabel }}
      </PlayText>

      <PlayText
        role="aside"
        class="text-amber-800/80"
      >
        Ta réponse : {{ screen.verdict.submittedAnswer || '(rien)' }}
      </PlayText>

      <!-- Voir specs/validation.md : la contestation se propose là où le
           désaccord naît, rattrapage compris. -->
      <PlayText
        v-if="contestable"
        role="link"
        as="button"
        type="button"
        :disabled="contesting"
        class="cursor-pointer text-amber-700 transition hover:text-amber-900 disabled:cursor-not-allowed disabled:opacity-60"
        @click="$emit('dispute')"
      >
        Contester cette question
      </PlayText>

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

    <!-- Ce qui court sur cette tentative. Le badge nommé plutôt qu'EffectPip,
         comme sur l'attente : il n'y a pas de ruban pour les loger ici, et le
         parchemin a la place d'écrire le sort en toutes lettres. -->
    <div
      v-if="screen.activeEffects.length"
      class="flex flex-wrap justify-center gap-[1cqw]"
    >
      <EffectBadge
        v-for="(effect, index) in screen.activeEffects"
        :key="index"
        :effect="effect"
        theme="parchment"
      />
    </div>

    <template #action>
      <CardButton
        v-if="screen.question"
        label="Valider"
        anchor="modal"
        face="plank"
        :disabled="submitting"
        @click="$emit('submit')"
      />
      <CardButton
        v-else-if="screen.action"
        :label="actionLabel"
        anchor="modal"
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

// La planche est large de trois fois sa hauteur : « Terminer le rattrapage »
// n'y tient pas à la taille des boutons de l'ascension, qui n'écrivent jamais
// plus d'un mot. WaitCard fait déjà ce raccourci sur le même bois
// (« Commencer » pour « Commencer le rattrapage ») — la destination est écrite
// juste au-dessus, le bouton n'a qu'à nommer le geste. Voir utils/phase.ts.
const actionLabel = computed(() => {
  switch (props.screen.recovery?.result) {
    case 'resumed':
      return 'Reprendre'
    case 'waiting':
      return 'Terminer'
    default:
      return props.screen.action ?? ''
  }
})

// Espace insécable avant la ponctuation double du français, comme QuestionCard :
// sinon un point d'interrogation esseulé se retrouve seul sur sa ligne.
const statement = computed(() =>
  (props.screen.question?.statement ?? props.screen.verdict?.statement ?? '')
    .replace(/ ([?!:;])/g, ' $1'),
)
</script>
