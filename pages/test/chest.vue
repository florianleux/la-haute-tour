<template>
  <ChestCard
    :chest="chest"
    :action="action"
    :opening="false"
    :advancing="false"
    @open="() => {}"
    @advance="() => {}"
  />
</template>

<script setup lang="ts">
// Banc de design de l'écran de coffre : même composant qu'en jeu
// (ChestCard), mais un état tiré au hasard à chaque chargement plutôt
// qu'une vraie ouverture — pour régler le visuel sans dépendre d'une question
// loot réellement jouée. Modifier ChestCard modifie donc aussi bien
// cette page que la vraie. Admin seulement. Voir pages/test/verdict.vue pour
// le même principe.
import { SPELL_IDS } from '~~/shared/utils/spells'
import type { ChestView } from '~~/server/utils/game'

definePageMeta({ admin: true })

function buildChest(): ChestView {
  const opened = Math.random() < 0.6
  // Le mimic pèse 5% en vrai (specs/bonus.md#coffre-et-mimic) — trop rare
  // pour se voir en rechargeant, donc gonflé ici pour ce banc.
  const mimic = opened && Math.random() < 0.3

  return {
    opened,
    mimic,
    spell: opened && !mimic ? SPELL_IDS[Math.floor(Math.random() * SPELL_IDS.length)] : null,
  }
}

const chest = ref<ChestView>(buildChest())
const action = ref(chest.value.opened ? 'Suivant' : null)
</script>
