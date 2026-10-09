<template>
  <ResultCard
    :state="state"
    :screen="screen"
    :effects="state.effects"
    :contestable="contestable"
    :contesting="false"
    :left-the-page="leftThePage"
    :advancing="false"
    @dispute="() => {}"
    @enter-chest="() => {}"
    @advance="() => {}"
  />
</template>

<script setup lang="ts">
// Banc de design de l'écran de résultat : même composant qu'en jeu
// (ResultCard), mais un verdict tiré au hasard à chaque chargement
// plutôt qu'une vraie partie — pour régler le visuel sans dépendre d'une
// question réellement jouée. Modifier ResultCard modifie donc aussi bien
// cette page que la vraie. Admin seulement. Voir pages/test/play.vue et
// pages/test/wait.vue pour le même principe.
import type { GameState } from '~~/server/utils/game'
import { gameScreen } from '~~/utils/phase'

definePageMeta({ admin: true })

const QUESTIONS = [
  { statement: 'Quel est le point culminant d\'Afrique ?', answerLabel: 'Le Kilimandjaro', submitted: 'Le Mont Blanc' },
  { statement: 'En quelle année a eu lieu la prise de la Bastille ?', answerLabel: '1789', submitted: '1789' },
  { statement: 'Qui a peint la Joconde ?', answerLabel: 'Léonard de Vinci', submitted: 'Michel-Ange' },
]

const picked = QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)]
const correct = Math.random() < 0.5
const phase = Math.random() < 0.7 ? 'ascent' : Math.random() < 0.5 ? 'floorEnd' : 'gameOver'

const contestable = ref(!correct && Math.random() < 0.5)
const leftThePage = ref(Math.random() < 0.2)

const state = ref<GameState>({
  phase,
  floor: 1,
  lives: 1 + Math.floor(Math.random() * 3),
  maxLives: 3,
  started: true,
  question: null,
  verdict: {
    questionId: 'test-verdict',
    statement: picked.statement,
    correct,
    answerLabel: picked.answerLabel,
    submittedAnswer: correct ? picked.answerLabel : picked.submitted,
    lifeLost: !correct,
  },
  cooldownUntil: null,
  recovery: null,
  recoveryResult: null,
  // Palier 545, sur un étage qui en compte largement plus.
  floorSeen: 544,
  floorTotal: 1000,
  // Série : question 995.
  attemptSeen: 995,
  chest: randomChest(),
  maintenance: false,
  effects: Array.from({ length: Math.floor(Math.random() * 4) }, () => randomEffect('active')),
  unlocked: [],
})

provideGameState(state)

const screen = computed(() => gameScreen(state.value))
</script>
