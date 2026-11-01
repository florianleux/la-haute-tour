<template>
  <QuestionCard
    v-if="view.card === 'question'"
    :state="state"
    :question="view.question"
    :model-value="typed"
    :seconds-left="secondsLeft"
    :submitting="false"
    :effects="effects"
    @update:model-value="typed = $event"
    @submit="submit"
  />

  <ResultCard
    v-else-if="view.card === 'result'"
    :state="state"
    :screen="view.screen"
    :effects="effects"
    :action="view.action"
    :disputable="false"
    :disputing="false"
    :advancing="false"
    @advance="drawQuestion"
  />
</template>

<script setup lang="ts">
// Banc de design de l'écran de question et de son verdict : mêmes composants
// qu'en jeu, mais une question tirée au hasard des extrêmes du deck
// (BENCH_QUESTIONS, utils/demo.ts) et des chiffres
// arbitraires à la place d'une vraie partie — pour régler le visuel sans
// dépendre d'une tentative réelle. On répond, le verdict s'affiche, « Suivant »
// tire une autre question. Les vies ne bougent jamais : rien ne se perd ici.
// Admin seulement. Voir components/QuestionCard.vue et components/ResultCard.vue.
import type { EffectView } from '~~/server/utils/effects'
// Le juge du jeu, partagé : rien ne s'écrit, l'admin a déjà les réponses
// acceptées sous les yeux, et un juge recopié finirait par diverger.
import { isAnswerAccepted } from '~~/shared/utils/answers'
import type { BenchQuestion } from '~~/utils/demo'
import { playView } from '~~/utils/phase'

definePageMeta({ admin: true })

const typed = ref('')

// De 60 à 0 puis on reboucle : jamais de soumission automatique, juste de quoi
// voir le médaillon vivre.
const secondsLeft = ref(60)
let timer: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  timer = setInterval(() => {
    secondsLeft.value = secondsLeft.value <= 0 ? 60 : secondsLeft.value - 1
  }, 1000)
})
onBeforeUnmount(() => {
  if (timer) {
    clearInterval(timer)
  }
})

// Un ou deux de chaque : deux est le maximum que l'écran doit encaisser, et un
// ruban vide ne montre rien à régler. Voir components/QuestionCard.vue.
// `useState` : tiré une fois au rendu serveur et repris tel quel au client —
// deux tirages donneraient deux écrans à l'hydratation.
const effects = useState<EffectView[]>('test-play-effects', () => [
  ...Array.from({ length: 1 + Math.floor(Math.random() * 2) }, () => randomEffect('active', 'boon')),
  ...Array.from({ length: 1 + Math.floor(Math.random() * 2) }, () => randomEffect('active', 'curse')),
])

// En ascension, jamais zéro : à zéro vie, le joueur est en attente, pas en
// train de répondre. Voir server/utils/mechanics.ts. `?vies=4` ou `?vies=5`
// montre le ruban d'une tentative gonflée par Vitalité.
const lives = useState('test-play-lives', () => Number(useRoute().query.vies) || 1 + Math.floor(Math.random() * 3))

const state = ref(demoState({
  lives: lives.value,
  maxLives: Math.max(3, lives.value),
  // Palier 545, sur un étage qui en compte largement plus.
  floorSeen: 544,
  floorTotal: 1000,
  // Série : 995 bonnes réponses d'affilée.
  streak: 995,
  seenTotal: 1_204,
  spellDiscovered: true,
  lessonsDone: ['camp'],
}))

provideGameState(state)

const view = computed(() => playView(state.value))

/** La question posée, réponses acceptées comprises : c'est le banc qui juge. */
const picked = ref<BenchQuestion | null>(null)

/** Le même identifiant pour la question posée et son verdict. */
const QUESTION_ID = 'test-play'

/** Une question au hasard du banc, posée à la place du verdict. */
function drawQuestion(): void {
  const question = randomBenchQuestion()
  picked.value = question
  typed.value = ''
  secondsLeft.value = 60
  state.value = {
    ...state.value,
    question: {
      id: QUESTION_ID,
      statement: question.statement,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      focusGraceMs: 1000,
      lootQuestion: false,
    },
    verdict: null,
  }
}

// Au client seulement : tirée au rendu serveur, la question serait retirée à
// l'hydratation, pour rien.
onMounted(drawQuestion)

// Comme en jeu (pages/index.vue) : Entrée passe du verdict à la question suivante.
useAdvanceOnEnter(drawQuestion, () => view.value.card === 'result')

/** Juge la réponse et montre le verdict, sans toucher aux vies. */
function submit(): void {
  const question = picked.value
  if (!question) {
    return
  }

  const correct = isAnswerAccepted(typed.value, question.acceptedAnswers)
  state.value = {
    ...state.value,
    question: null,
    verdict: {
      questionId: QUESTION_ID,
      statement: question.statement,
      correct,
      answerLabel: question.answerLabel,
      submittedAnswer: typed.value,
      // Dit comme en jeu, pour voir le cadre encaisser ; les vies, elles, ne
      // bougent pas.
      lifeLost: !correct,
      focusLoss: false,
    },
  }
}
</script>
