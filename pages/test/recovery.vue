<template>
  <RecoveryCard
    :screen="screen"
    :model-value="typed"
    :seconds-left="secondsLeft"
    :submitting="false"
    :contestable="contestable"
    :contesting="false"
    :advancing="false"
    @update:model-value="typed = $event"
    @submit="() => {}"
    @dispute="() => {}"
    @advance="() => {}"
  />
</template>

<script setup lang="ts">
// Banc de design de l'écran de rattrapage : même composant qu'en jeu
// (RecoveryCard), mais un état tiré au hasard à chaque chargement plutôt qu'un
// vrai rattrapage — pour régler le visuel sans avoir à perdre trois vies puis
// attendre. Modifier RecoveryCard modifie donc aussi bien cette page que la
// vraie. Admin seulement. Voir pages/test/play.vue pour le même principe.
import { SPELL_FACES, SPELL_IDS } from '~~/shared/utils/spells'
import type { EffectView } from '~~/server/utils/effects'
import type { GameState } from '~~/server/utils/game'
import { gameScreen } from '~~/utils/phase'

definePageMeta({ admin: true })

const typed = ref('')

// De 60 à 0 puis on reboucle : jamais de perte, jamais de soumission
// automatique, juste de quoi voir le médaillon vivre. Comme pages/test/play.vue.
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

function randomEffect(): EffectView {
  return {
    spell: SPELL_IDS[Math.floor(Math.random() * SPELL_IDS.length)],
    face: SPELL_FACES[Math.floor(Math.random() * SPELL_FACES.length)],
    casterName: CASTER_NAMES[Math.floor(Math.random() * CASTER_NAMES.length)],
    state: 'active',
  }
}

// Question ou verdict, et un verdict scellé une fois sur deux : les quatre états
// que la carte doit encaisser, tirés à chaque rechargement.
const answering = Math.random() < 0.5
const correct = Math.random() < 0.5
const sealed = !answering && Math.random() < 0.5

const STATEMENT = 'Quel est le point culminant d\'Afrique ?'

const state = ref<GameState>({
  phase: 'recovery',
  floor: 1,
  // Le rattrapage ne se joue qu'à zéro vie : c'est sa définition même.
  lives: 0,
  maxLives: 3,
  started: true,
  question: answering
    ? {
        id: 'test-recovery',
        statement: STATEMENT,
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        focusGraceMs: 1000,
        // Jamais de coffre en rattrapage : isLootQuestion rend false pour ce
        // mode. Voir server/utils/mechanics.ts.
        lootQuestion: false,
      }
    : null,
  verdict: answering
    ? null
    : {
        questionId: 'test-recovery',
        statement: STATEMENT,
        correct,
        answerLabel: 'Le Kilimandjaro',
        submittedAnswer: correct ? 'Kilimandjaro' : 'Le Mont Blanc',
        // Le rattrapage ne coûte aucune vie. Voir server/utils/game.ts.
        lifeLost: false,
      },
  cooldownUntil: null,
  // `resumes` suit le quota atteint, pas la dernière réponse : un tirage scellé
  // sur trop peu de succès ne reprend jamais. Le banc fait donc varier les
  // succès avec le sort, sinon il montrerait un état que resumesRecovery ne
  // rend jamais. Voir server/utils/mechanics.ts.
  recovery: {
    total: 5,
    played: answering ? 2 : 3,
    successes: sealed && correct ? 5 : 2,
    sealed,
    resumes: sealed && correct,
    lengthened: Math.random() < 0.5,
  },
  recoveryResult: null,
  floorSeen: 544,
  floorTotal: 1000,
  attemptSeen: 995,
  chest: null,
  maintenance: false,
  effects: Array.from({ length: Math.floor(Math.random() * 3) }, randomEffect),
  unlocked: [],
})

// Le lien de contestation ne se propose que sur un verdict faux, comme en jeu.
const contestable = !answering && !correct

const screen = computed(() => gameScreen(state.value))
</script>
