<template>
  <QuestionCard
    v-if="state && question"
    :state="state"
    :question="question"
    :model-value="typed"
    :seconds-left="secondsLeft"
    :submitting="false"
    :effects="effects"
    @update:model-value="typed = $event"
    @submit="() => {}"
  />
</template>

<script setup lang="ts">
// Banc de design de l'écran de question : mêmes composants qu'en jeu, mais une
// question tirée au hasard du deck et des chiffres arbitraires à la place d'une
// vraie partie — pour régler le visuel sans dépendre d'une tentative réelle ni
// perdre à l'écoulement du chrono. Admin seulement. Voir components/QuestionCard.vue.
import type { EffectView } from '~~/server/utils/effects'
import type { GameState, ServedQuestion } from '~~/server/utils/game'
import type { AdminQuestionsResponse } from '~~/server/api/admin/questions/index.get'

definePageMeta({ admin: true })

const typed = ref('')

// De 60 à 0 puis on reboucle : jamais de perte, jamais de soumission
// automatique, juste de quoi voir le médaillon vivre.
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

const question = ref<ServedQuestion | null>(null)

const { data: total } = await useAsyncData(
  'test-play-question-total',
  () => $fetch<AdminQuestionsResponse>('/api/admin/questions', {
    ...useApiFetchOptions(),
    query: { floor: 1, limit: 1, page: 1 },
  }),
)

if (total.value?.total) {
  const randomPage = 1 + Math.floor(Math.random() * total.value.total)
  const { questions } = await $fetch<AdminQuestionsResponse>('/api/admin/questions', {
    ...useApiFetchOptions(),
    query: { floor: 1, limit: 1, page: randomPage },
  })
  const picked = questions[0]

  if (picked) {
    question.value = {
      id: picked.id,
      statement: picked.statement,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      focusGraceMs: 1000,
      lootQuestion: false,
    }
  }
}

const state = ref<GameState>({
  phase: 'ascent',
  floor: 1,
  // En ascension, jamais zéro : à zéro vie, le joueur est en attente, pas en
  // train de répondre. Voir server/utils/mechanics.ts.
  lives: 1 + Math.floor(Math.random() * 3),
  maxLives: 3,
  started: true,
  question: null,
  verdict: null,
  cooldownUntil: null,
  recovery: null,
  recoveryResult: null,
  // Palier 545, sur un étage qui en compte largement plus.
  floorSeen: 544,
  floorTotal: 1000,
  // Série : question 995.
  attemptSeen: 995,
  chest: null,
  maintenance: false,
  effects: [],
  unlocked: [],
})

provideGameState(state)
</script>
