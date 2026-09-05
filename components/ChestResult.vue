<script setup lang="ts">
// Ce qu'un coffre ouvert a donné. Écrit une fois : le résultat se lit sur le
// verdict, et sur l'écran d'attente quand c'est un Mimic qui y a envoyé le
// joueur. Voir specs/bonus.md#coffre-et-mimic.
import type { ChestView } from '~~/server/utils/game'

defineProps<{ chest: ChestView }>()
</script>

<template>
  <BaseHint v-if="chest.mimic" tone="danger">
    Un mimic. Aucun objet, et toutes tes vies d'un coup.
  </BaseHint>
  <BaseHint v-else-if="chest.spell" tone="success">
    Le coffre contenait <strong>{{ spellLabel(chest.spell) }}</strong>. Il rejoint ton inventaire.
  </BaseHint>
</template>
