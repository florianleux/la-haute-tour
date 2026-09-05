<template>
  <!-- La phrase qui porte un moment de jeu : l'énoncé, le verdict, le palier. -->
  <p class="text-lg" :class="[toneClass(tone, 'text-slate-100'), weight === 'light' ? 'font-light' : 'font-semibold']">
    <slot />
  </p>
</template>

<script setup lang="ts">
import type { Tone } from '~~/utils/tone'

withDefaults(defineProps<{
  /** Ce que la phrase annonce : une réussite, une perte, ou ni l'un ni l'autre. */
  tone?: Tone
  /** L'énoncé d'une question se lit en Light, le reste en Semibold. */
  weight?: 'light' | 'semibold'
}>(), { tone: 'neutral', weight: 'semibold' })
</script>
