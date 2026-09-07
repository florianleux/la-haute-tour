<template>
  <!-- Le survol dit le sort et ce qu'il fait au joueur : le pip seul ne suffit
       pas à s'en souvenir. Voir specs/bonus.md#catalogue. -->
  <span
    class="flex h-6 w-6 items-center justify-center rounded-full border text-xs"
    :class="tone"
    :title="description"
  >
    ✦
  </span>
</template>

<script setup lang="ts">
import type { EffectView } from '~~/server/utils/effects'

const props = defineProps<{ effect: EffectView }>()

const tone = computed(() => (props.effect.face === 'boon'
  ? 'border-rose-800 bg-rose-100 text-rose-800'
  : 'border-rose-800 bg-rose-100 text-rose-800'))

const description = computed(() =>
  `${spellLabel(props.effect.spell)} — ${spellEffects(props.effect.spell)[props.effect.face]}`)
</script>
