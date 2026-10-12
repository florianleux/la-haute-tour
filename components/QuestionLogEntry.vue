<template>
  <li>
    <BaseParchmentRow :selected="selected" @click="$emit('select')">
      <span
        class="font-bold"
        :class="entry.correct ? 'text-emerald-700' : 'text-rose-700'"
        :aria-label="entry.correct ? 'Juste' : 'Fausse'"
      >
        {{ entry.correct ? '✓' : '✗' }}
      </span>
      <span class="line-clamp-2 min-w-0 flex-1">
        {{ withNonBreakingSpaces(entry.statement) }}
      </span>
    </BaseParchmentRow>
  </li>
</template>

<script setup lang="ts">
// Une question vue, dans la liste du Volumen : l'énoncé et le verdict, rien de
// plus. La réponse se lit à côté, une fois la ligne choisie (QuestionLogDetail).
// Voir specs/ecrans.md#volumen.
import type { QuestionLogEntryView } from '~~/server/utils/game'

defineProps<{
  entry: QuestionLogEntryView
  selected: boolean
}>()

defineEmits<{ select: [] }>()
</script>
