<template>
  <ResultCard
    :state="state"
    :screen="view.screen"
    :effects="view.screen.activeEffects"
    :action="view.action"
    :disputable="disputable"
    :disputing="false"
    :advancing="false"
    @dispute="() => {}"
    @advance="() => {}"
  />
</template>

<script setup lang="ts">
// Banc de design de l'écran de résultat : même composant qu'en jeu
// (ResultCard), mais un verdict tiré au hasard à chaque chargement
// plutôt qu'une vraie partie — pour régler le visuel sans dépendre d'une
// question réellement jouée. Modifier ResultCard modifie donc aussi bien
// cette page que la vraie. Admin seulement. Voir pages/test/play.vue et
// pages/test/cooldown.vue pour le même principe.
import type { GameState } from '~~/server/utils/game'
import { playView } from '~~/utils/phase'

definePageMeta({ admin: true })

const QUESTIONS = [
  { statement: 'Quel est le point culminant d\'Afrique ?', answerLabel: 'Le Kilimandjaro', submitted: 'Le Mont Blanc' },
  { statement: 'En quelle année a eu lieu la prise de la Bastille ?', answerLabel: '1789', submitted: '1789' },
  { statement: 'Qui a peint la Joconde ?', answerLabel: 'Léonard de Vinci', submitted: 'Michel-Ange' },
]

// Tirés une fois, côté serveur, puis relus tels quels par le client
// (useState) : tirés deux fois, le serveur pouvait rendre un verdict juste et
// le client un faux, et l'hydratation gardait les classes de l'un sous le
// texte de l'autre.
const state = useState<GameState>('test-verdict-state', () => {
  const picked = QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)]
  const correct = Math.random() < 0.5
  const phase = Math.random() < 0.7 ? 'ascent' : Math.random() < 0.5 ? 'floorEnd' : 'gameOver'

  return demoState({
    phase,
    lives: 1 + Math.floor(Math.random() * 3),
    verdict: {
      questionId: 'test-verdict',
      statement: picked.statement,
      correct,
      answerLabel: picked.answerLabel,
      submittedAnswer: correct ? picked.answerLabel : picked.submitted,
      lifeLost: !correct,
    },
    // Palier 545, sur un étage qui en compte largement plus.
    floorSeen: 544,
    floorTotal: 1000,
    // Série : question 995.
    attemptSeen: 995,
    chest: randomChest(),
    effects: Array.from({ length: Math.floor(Math.random() * 4) }, () => randomEffect('active')),
  })
})

const disputable = useState('test-verdict-disputable', () => !state.value.verdict?.correct && Math.random() < 0.5)

provideGameState(state)

const view = computed(() => playView(state.value))
</script>
