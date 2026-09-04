<script setup lang="ts">
import type { Tone } from '~~/utils/tone'

withDefaults(defineProps<{ tone?: Tone }>(), { tone: 'neutral' })
</script>

<template>
  <!-- Le texte secondaire de toutes les cartes : la taille écrite une fois, la
       même voix partout. -->
  <p class="text-sm" :class="toneClass(tone, 'text-slate-400')">
    <slot />
  </p>
</template>
