<template>
  <BaseHint v-if="chest.mimic" tone="danger">
    Un mimic. Aucun objet, et toutes tes vies d'un coup.
  </BaseHint>
  <BaseHint v-else-if="chest.spell" tone="success">
    Le coffre contenait <strong>{{ spellLabel(chest.spell) }}</strong>. Il rejoint ton inventaire.
  </BaseHint>
</template>

<script setup lang="ts">
// Ce qu'un coffre ouvert a donné. Repris uniquement sur l'écran d'attente,
// pour le cas Mimic — ChestCard porte sa propre copie de ces mêmes
// messages pour l'ouverture normale, hors du système Base* dont celui-ci
// dépend. Voir specs/bonus.md#coffre-et-mimic.
import type { ChestView } from '~~/server/utils/game'

defineProps<{ chest: ChestView }>()
</script>
