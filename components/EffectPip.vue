<template>
  <!-- Le survol dit le sort et ce qu'il fait au joueur : le pip seul ne suffit
       pas à s'en souvenir. Voir specs/bonus.md#catalogue.
       Le médaillon blanc dit un bonus, le noir un malus ; un sort sans
       médaillon retombe sur l'étincelle. L'ombre le détache du ruban. -->
  <img
    v-if="image"
    :src="image"
    :alt="description"
    :title="description"
    class="aspect-square w-[6.5cqw] object-contain [filter:drop-shadow(0_2px_3px_rgb(0_0_0/0.55))] sm:w-[3cqw]"
  >
  <span
    v-else
    class="flex h-6 w-6 items-center justify-center rounded-full border border-rose-800 bg-rose-100 text-xs text-rose-800"
    :title="description"
  >
    ✦
  </span>
</template>

<script setup lang="ts">
import type { EffectView } from '~~/server/utils/effects'

const props = defineProps<{ effect: EffectView }>()

const image = computed(() => spellImage(props.effect.spell, props.effect.face))

const description = computed(() =>
  `${spellLabel(props.effect.spell)} — ${spellEffects(props.effect.spell)[props.effect.face]}`)
</script>
