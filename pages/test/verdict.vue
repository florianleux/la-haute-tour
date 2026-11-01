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
// (ResultCard), mais un verdict tiré au hasard à chaque chargement, sur les
// extrêmes du deck (BENCH_QUESTIONS, utils/demo.ts),
// plutôt qu'une vraie partie — pour régler le visuel sans dépendre d'une
// question réellement jouée. Modifier ResultCard modifie donc aussi bien
// cette page que la vraie. Admin seulement. Voir pages/test/play.vue et
// pages/test/cooldown.vue pour le même principe.
import type { GameState } from '~~/server/utils/game'
import { playView } from '~~/utils/phase'

definePageMeta({ admin: true })

// Tirés une fois, côté serveur, puis relus tels quels par le client
// (useState) : tirés deux fois, le serveur pouvait rendre un verdict juste et
// le client un faux, et l'hydratation gardait les classes de l'un sous le
// texte de l'autre.
const state = useState<GameState>('test-verdict-state', () => {
  const picked = randomBenchQuestion()
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
      submittedAnswer: correct ? picked.acceptedAnswers[0] : picked.wrongAnswer,
      lifeLost: !correct,
      // `?left` : la réponse partie avec la page.
      leftThePage: useRoute().query.left !== undefined,
    },
    // Palier 545, sur un étage qui en compte largement plus.
    floorSeen: 544,
    floorTotal: 1000,
    // Série : 995 bonnes réponses d'affilée.
    streak: 995,
    chest: randomChest(),
    effects: Array.from({ length: Math.floor(Math.random() * 4) }, () => randomEffect('active')),
  })
})

const disputable = useState('test-verdict-disputable', () => !state.value.verdict?.correct && Math.random() < 0.5)

provideGameState(state)

const view = computed(() => playView(state.value))
</script>
