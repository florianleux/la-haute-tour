<template>
  <PlayText
    role="mark"
    as="span"
    :class="correct ? 'text-emerald-600' : 'text-rose-600'"
  >
    {{ correct ? '✓' : '✗' }}
  </PlayText>
</template>

<script setup lang="ts">
// Le juste ou faux du médaillon, à la place du chrono : il n'y a plus de temps
// qui court sur un verdict. Ascension et rattrapage le montrent à l'identique,
// donc il s'écrit ici plutôt que deux fois.
defineProps<{ correct: boolean }>()
</script>
