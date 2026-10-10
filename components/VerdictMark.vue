<template>
  <PlayText
    role="mark"
    as="span"
    :class="correct ? 'inline-block text-emerald-600 motion-safe:animate-stamp [--enter-delay:0s]' : 'text-rose-600'"
  >
    {{ correct ? '✓' : '✗' }}
  </PlayText>
</template>

<script setup lang="ts">
// Le juste ou faux du médaillon, à la place du chrono : il n'y a plus de temps
// qui court sur un verdict. Ascension et rattrapage le montrent à l'identique,
// donc il s'écrit ici plutôt que deux fois. Le ✓ s'y frappe comme un tampon
// (`inline-block` : un span en ligne ignore `transform`), sans attendre :
// `--enter-delay` remis à zéro, sinon il hériterait de celui du médaillon.
defineProps<{ correct: boolean }>()
</script>
