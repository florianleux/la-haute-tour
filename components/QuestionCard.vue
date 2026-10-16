<template>
  <PlayFrame
    skin="ascent"
    :motion="submitting ? 'judging' : undefined"
  >
    <template #ribbons>
      <StatsRibbons
        :state="state"
        :effects="effects"
      />
    </template>

    <template #medallion>
      <PlayText
        role="timer"
        as="span"
        class="text-amber-600"
      >
        {{ secondsLeft }}
      </PlayText>
    </template>

    <!-- Le joueur sait avant de répondre que ce passage vaut un coffre.
         Voir specs/bonus.md#question-loot. -->
    <PlayText
      v-if="question.lootQuestion"
      role="notice"
      class="uppercase tracking-wide text-emerald-700"
    >
      Question loot — réponds juste et tu ouvres un coffre.
    </PlayText>

    <PlayText
      role="statement"
      class="text-amber-800"
    >
      {{ statement }}
    </PlayText>

    <!-- Le même champ qu'en rattrapage (RecoveryCard) : on répond pareil des
         deux côtés. -->
    <BaseParchmentInput
      :model-value="modelValue"
      @update:model-value="$emit('update:modelValue', $event)"
      @submit="$emit('submit')"
    />

    <template #action>
      <BaseCardButton
        label="Valider"
        anchor="card-bottom"
        :loading="submitting"
        @click="$emit('submit')"
      />
    </template>
  </PlayFrame>
</template>

<script setup lang="ts">
// L'écran de question en ascension. Le décor, le cadre, le médaillon et le
// panneau viennent de PlayFrame ; les tailles de texte de PlayText. Ne reste
// ici que ce que cet écran a de propre : ce qu'il dit, et le champ de réponse.
//
// Écrit à part de BaseButton/BaseInput, dont les classes portent le thème
// sombre : les reprendre ici les recouvrirait en ligne, ce que CLAUDE.md
// interdit — plus simple de sortir du système Base* pour les écrans reskinés.
import type { GameState, ServedQuestion } from '~~/server/utils/game'
import type { EffectView } from '~~/server/utils/effects'

const props = defineProps<{
  state: GameState
  question: ServedQuestion
  modelValue: string
  secondsLeft: number | null
  /** Une réponse est en vol, envoyée au clic comme à la fin du chrono : la carte le joue. */
  submitting: boolean
  effects: EffectView[]
}>()

defineEmits<{ 'update:modelValue': [string], submit: [] }>()

const statement = computed(() => withNonBreakingSpaces(props.question.statement))
</script>
