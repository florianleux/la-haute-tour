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
// Une rangée d'effets, badge par badge, pour la vue de repli au thème sombre de
// pages/index.vue. Les écrans de parchemin écrivent le sort en toutes lettres,
// voir components/SpellMention.vue. Voir specs/bonus.md#écrans.
import type { EffectView } from '~~/server/utils/effects'

defineProps<{ effects: EffectView[] }>()
</script>
