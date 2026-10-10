<template>
  <CooldownCard
    :state="state"
    :screen="screen"
    cooldown-remaining="4m 12s"
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
// (CooldownCard), mais un état tiré au hasard à chaque chargement plutôt
// qu'une vraie partie — pour régler le visuel sans dépendre d'une attente
// réelle. Modifier CooldownCard modifie donc aussi bien cette page que la
// vraie. Admin seulement. Voir pages/test/play.vue pour le même principe.
import type { GameState } from '~~/server/utils/game'
import { gameScreen } from '~~/utils/phase'

definePageMeta({ admin: true })

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
  recoveryResult: null,
  floorSeen: 544,
  floorTotal: 1000,
  attemptSeen: 995,
  chest: randomChest(),
  maintenance: false,
  effects: Array.from({ length: Math.floor(Math.random() * 4) }, () => randomEffect('pending')),
  unlocked: [],
})

provideGameState(state)

const screen = computed(() => gameScreen(state.value))
</script>
