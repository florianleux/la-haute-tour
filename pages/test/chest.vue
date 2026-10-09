<template>
  <ChestCard
    :state="state"
    :effects="[]"
    :chest="chest"
    :action="chest.opened ? 'Rejouer' : null"
    :opening="false"
    :advancing="false"
    @open="openChest"
    @advance="resetChest"
  />
</template>

<script setup lang="ts">
// Banc de design de l'écran de coffre : même composant qu'en jeu
// (ChestCard), mais un tirage local plutôt qu'une vraie ouverture — pour
// régler le visuel sans dépendre d'une question loot réellement jouée.
// Le coffre arrive toujours fermé, ne s'ouvre qu'au clic, puis « Rejouer »
// en remet un fermé. Modifier ChestCard modifie donc aussi bien cette page
// que la vraie. Admin seulement. Voir pages/test/verdict.vue pour le même
// principe.
import { SPELL_IDS } from '~~/shared/utils/spells'
import type { ChestView, GameState } from '~~/server/utils/game'

definePageMeta({ admin: true })

// De quoi remplir les rubans, rien de plus : ce banc règle le coffre.
const state: GameState = {
  phase: 'ascent',
  floor: 1,
  lives: 2,
  maxLives: 3,
  started: true,
  question: null,
  verdict: null,
  cooldownUntil: null,
  recovery: null,
  recoveryResult: null,
  floorSeen: 49,
  floorTotal: 166,
  attemptSeen: 12,
  chest: null,
  maintenance: false,
  effects: [],
  unlocked: [],
}

const CLOSED: ChestView = { opened: false, mimic: false, spell: null }

const chest = ref<ChestView>(CLOSED)

function openChest(): void {
  // Le mimic pèse 5% en vrai (specs/bonus.md#coffre-et-mimic) — trop rare
  // pour se voir en rejouant, donc gonflé ici pour ce banc.
  const mimic = Math.random() < 0.3
  chest.value = {
    opened: true,
    mimic,
    spell: mimic ? null : SPELL_IDS[Math.floor(Math.random() * SPELL_IDS.length)],
  }
}

function resetChest(): void {
  chest.value = CLOSED
}
</script>
