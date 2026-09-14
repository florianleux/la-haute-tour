<template>
  <PlayText
    role="headline"
    :class="verdict.correct ? 'text-emerald-700' : 'text-rose-700'"
  >
    {{ verdict.correct ? 'Correct !' : 'Incorrect...' }}
  </PlayText>

  <PlayText
    role="recall"
    class="text-amber-800"
  >
    {{ withNonBreakingSpaces(verdict.statement) }}
  </PlayText>

  <PlayText
    role="answer"
    class="text-amber-800"
  >
    {{ verdict.answerLabel }}
  </PlayText>

  <PlayText
    role="aside"
    class="text-amber-800/80"
  >
    Ta réponse : {{ verdict.submittedAnswer || '(rien)' }}
  </PlayText>

  <!-- La vie perdue, le cas échéant : les rubans montrent le compte d'après,
       pas le fait qu'on vienne d'en perdre une. Voir specs/ecrans.md#ascent--verdict.
       Toujours faux en rattrapage, qui ne coûte aucune vie — la ligne s'efface
       donc d'elle-même de ce côté. Voir server/utils/game.ts. -->
  <PlayText
    v-if="verdict.lifeLost"
    role="notice"
    class="text-rose-700"
  >
    Tu perds une vie !
  </PlayText>

  <!-- Voir specs/validation.md : la contestation se propose là où le désaccord
       naît, en ascension comme en rattrapage. -->
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
</template>

<script setup lang="ts">
// Ce que dit un verdict : juste ou faux, l'énoncé rappelé, la bonne réponse, ce
// que le joueur avait tapé, la vie perdue, et le geste de contestation. Voir
// specs/ecrans.md#ascent--verdict.
//
// Écrit une fois : l'ascension et le rattrapage rendent exactement les mêmes
// lignes, et CLAUDE.md demande le composant partagé avant la deuxième copie. Ce
// qui suit ces lignes diffère d'un écran à l'autre — coffre gagné d'un côté,
// sort du rattrapage de l'autre — et reste donc chez l'appelant.
import type { Verdict } from '~~/server/utils/game'

defineProps<{
  verdict: Verdict
  contestable: boolean
  contesting: boolean
}>()

defineEmits<{ dispute: [] }>()
</script>
