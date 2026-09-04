<script setup lang="ts">
import type { ContestableError } from '~~/server/utils/disputes'

// Le filet de l'écran d'attente : les erreurs de la tentative, pour qui est
// passé trop vite à la question suivante. Voir specs/ecrans.md#cooldown--attente.
defineProps<{
  errors: ContestableError[]
  pending: boolean
}>()

defineEmits<{ contest: [string] }>()
</script>

<template>
  <BaseSection v-if="errors.length" title="Pas d'accord ?">
    <template #lead>
      Ces erreurs de ta tentative peuvent encore être arbitrées. Une seule fois par question.
    </template>

    <BaseList :empty="null" class="mt-4">
      <li
        v-for="error in errors"
        :key="error.questionId"
        class="flex items-start justify-between gap-4 px-4 py-3"
      >
        <div>
          <p class="text-sm">
            {{ error.statement }}
          </p>
          <BaseHint class="mt-1">
            Ta réponse : {{ error.submittedAnswer }} — attendue :
            <AnswerLabel :label="error.answerLabel" />
          </BaseHint>
        </div>

        <BaseButton
          variant="ghost"
          class="shrink-0"
          :loading="pending"
          @click="$emit('contest', error.questionId)"
        >
          Contester
        </BaseButton>
      </li>
    </BaseList>
  </BaseSection>
</template>
