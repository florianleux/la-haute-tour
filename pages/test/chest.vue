<template>
  <ChestCard
    :state="state"
    :effects="[]"
    :chest="chest"
    :action="view.action"
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
// Le coffre arrive toujours fermé, ne s'ouvre qu'au clic, puis le bouton du
// jeu (« Suivant ») en remet un fermé. Modifier ChestCard modifie donc aussi bien cette page
// que la vraie. Admin seulement. Voir pages/test/verdict.vue pour le même
// principe.
import { SPELL_IDS } from '~~/shared/utils/spells'
import type { ChestView } from '~~/server/utils/game'
import { playView } from '~~/utils/phase'

definePageMeta({ admin: true })

// La question loot dont le verdict a gagné le coffre, et dont la page a ouvert
// l'écran.
const QUESTION_ID = 'test-chest'

const CLOSED: ChestView = { opened: false, mimic: false, spell: null, key: false }

const chest = ref<ChestView>(CLOSED)

// De quoi remplir les rubans, et le verdict juste d'une question loot qui a
// gagné le coffre : le bouton une fois ouvert est celui du jeu, et ramène ici
// un coffre fermé.
const state = computed(() => demoState({
  // Le Mimic les prend toutes, comme en vrai.
  lives: chest.value.mimic ? 0 : 2,
  // La question servie est la 25e : `questionsPerChest` de server/utils/rules.ts.
  floorSeen: 24,
  floorTotal: 166,
  streak: 12,
  seenTotal: 1_204,
  spellDiscovered: true,
  lessonsDone: ['camp'],
  verdict: {
    questionId: QUESTION_ID,
    statement: 'Quel est le point culminant d\'Afrique ?',
    correct: true,
    answerLabel: 'Le Kilimandjaro',
    submittedAnswer: 'Le Kilimandjaro',
    lifeLost: false,
    leftThePage: false,
  },
  chest: chest.value,
}))

const view = computed(() => playView(state.value, { chestOf: QUESTION_ID, fallenOn: null }))

provideGameState(state)

function openChest(): void {
  // Le mimic pèse 5% en vrai (specs/bonus.md#coffre-et-mimic), la clé un
  // coffre par étage (specs/boss.md#obtention-de-la-clé) — trop rares pour se
  // voir en rejouant, donc gonflés ici pour ce banc.
  const roll = Math.random()
  const mimic = roll < 0.3
  const key = !mimic && roll < 0.6
  chest.value = {
    opened: true,
    mimic,
    spell: mimic || key ? null : SPELL_IDS[Math.floor(Math.random() * SPELL_IDS.length)],
    key,
  }
}

function resetChest(): void {
  chest.value = CLOSED
}
</script>
