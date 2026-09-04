<script setup lang="ts">
import type { Tone } from '~~/utils/tone'

withDefaults(defineProps<{
  /** Ce que la phrase annonce : une réussite, une perte, ou ni l'un ni l'autre. */
  tone?: Tone
}>(), { tone: 'neutral' })
</script>

<template>
  <!-- La phrase qui porte un moment de jeu : l'énoncé, le verdict, le palier. -->
  <p class="text-lg font-semibold" :class="toneClass(tone, 'text-slate-100')">
    <slot />
  </p>
</template>
