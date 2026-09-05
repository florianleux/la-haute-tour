<template>
  <div class="flex flex-wrap gap-2">
    <EffectBadge
      v-for="(effect, index) in effects"
      :key="index"
      :effect="effect"
    />
  </div>
</template>

<script setup lang="ts">
// Une rangée d'effets, badge par badge. Écrite une fois : l'attente récapitule
// ce qui vient, l'ascension montre ce qui court, et les deux se ressemblent
// parce que c'est le même état. Voir specs/bonus.md#écrans.
import type { EffectView } from '~~/server/utils/effects'

defineProps<{ effects: EffectView[] }>()
</script>
