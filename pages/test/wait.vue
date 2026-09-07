<template>
  <WaitCard
    :state="state"
    :screen="screen"
    wait-remaining="4m 12s"
    :loading="false"
    :is-admin="true"
    :skipping="false"
    :advancing="false"
    @skip-cooldown="() => {}"
    @advance="() => {}"
  />
</template>

<script setup lang="ts">
// Banc de design de l'écran d'attente : même composant qu'en jeu
// (WaitCard), mais un état tiré au hasard à chaque chargement plutôt
// qu'une vraie partie — pour régler le visuel sans dépendre d'une attente
// réelle. Modifier WaitCard modifie donc aussi bien cette page que la
// vraie. Admin seulement. Voir pages/test/play.vue pour le même principe.
import { SPELL_FACES, SPELL_IDS } from '~~/shared/utils/spells'
import type { EffectView } from '~~/server/utils/effects'
import type { ChestView, GameState } from '~~/server/utils/game'
import { gameScreen } from '~~/utils/phase'

definePageMeta({ admin: true })

const CASTER_NAMES = ['Gandalf', 'Bilbo', 'Frodo', 'Aragorn', 'Éowyn', 'Legolas']

function randomEffect(state: EffectView['state']): EffectView {
  return {
    spell: SPELL_IDS[Math.floor(Math.random() * SPELL_IDS.length)],
    face: SPELL_FACES[Math.floor(Math.random() * SPELL_FACES.length)],
    casterName: CASTER_NAMES[Math.floor(Math.random() * CASTER_NAMES.length)],
    state,
  }
}

function buildChest(): ChestView | null {
  if (Math.random() < 0.5) {
    return null
  }

  const opened = Math.random() < 0.6
  const mimic = opened && Math.random() < 0.2

  return {
    opened,
    mimic,
    spell: opened && !mimic ? SPELL_IDS[Math.floor(Math.random() * SPELL_IDS.length)] : null,
  }
}

const phase = Math.random() < 0.5 ? 'cooldown' : 'recovery'

const state = ref<GameState>({
  phase,
  floor: 1,
  lives: 0,
  maxLives: 3,
  started: true,
  question: null,
  verdict: Math.random() < 0.5
    ? null
    : {
        questionId: 'test-verdict',
        statement: 'Quel est le point culminant d\'Afrique ?',
        correct: false,
        answerLabel: 'Le Kilimandjaro',
        submittedAnswer: 'Le Mont Blanc',
        lifeLost: true,
      },
  cooldownUntil: new Date(Date.now() + 252_000).toISOString(),
  recovery: null,
  recoveryResult: Math.random() < 0.3 ? 'failed' : null,
  floorSeen: 544,
  floorTotal: 1000,
  attemptSeen: 995,
  chest: buildChest(),
  maintenance: false,
  effects: Array.from({ length: Math.floor(Math.random() * 4) }, () => randomEffect('pending')),
})

const screen = computed(() => gameScreen(state.value))
</script>
