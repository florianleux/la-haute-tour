<template>
  <TowerQuestionCard
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
// perdre à l'écoulement du chrono. Admin seulement. Voir components/TowerQuestionCard.vue.
import { SPELL_IDS } from '~~/shared/utils/spells'
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

const CASTER_NAMES = ['Gandalf', 'Bilbo', 'Frodo', 'Aragorn', 'Éowyn', 'Legolas']

function randomEffect(face: EffectView['face']): EffectView {
  return {
    spell: SPELL_IDS[Math.floor(Math.random() * SPELL_IDS.length)],
    face,
    casterName: CASTER_NAMES[Math.floor(Math.random() * CASTER_NAMES.length)],
    state: 'active',
  }
}

// Deux au plus de chaque : c'est le maximum que l'écran doit encaisser, pas
// une moyenne. Voir components/TowerQuestionCard.vue.
const boonCount = Math.floor(Math.random() * 3)
const curseCount = Math.floor(Math.random() * 3)
const effects = ref<EffectView[]>([
  ...Array.from({ length: boonCount }, () => randomEffect('boon')),
  ...Array.from({ length: curseCount }, () => randomEffect('curse')),
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
})
</script>
