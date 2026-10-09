<template>
  <!-- Le survol ouvre l'infobulle du sort : le pip seul ne suffit pas à s'en
       souvenir. Voir specs/bonus.md#linfobulle-dun-sort.
       Le médaillon blanc dit un bonus, le noir un malus. L'ombre le détache du
       ruban. -->
  <SpellTooltip
    :subject="effect"
    class="cursor-pointer transition-transform hover:scale-110"
  >
    <SpellMedallion
      :spell="effect.spell"
      :face="effect.face"
      :alt="description"
      class="w-[6.5cqw] [filter:drop-shadow(0_2px_3px_rgb(0_0_0/0.55))] sm:w-[3cqw]"
      fallback-class="border border-rose-800 bg-rose-100 text-xs text-rose-800"
    />
  </SpellTooltip>
</template>

<script setup lang="ts">
import type { EffectView } from '~~/server/utils/effects'

const props = defineProps<{ effect: EffectView }>()

const description = computed(() =>
  `${spellLabel(props.effect.spell)} — ${spellEffects(props.effect.spell)[props.effect.face]}`)
</script>
