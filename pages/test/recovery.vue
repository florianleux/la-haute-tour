<template>
  <RecoveryCard
    :screen="view.screen"
    :action="view.action"
    :model-value="typed"
    :seconds-left="secondsLeft"
    :submitting="false"
    :disputable="disputable"
    :disputing="false"
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
import { playView } from '~~/utils/phase'

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

// Question ou verdict, et un verdict scellé une fois sur deux : les quatre états
// que la carte doit encaisser, tirés à chaque rechargement.
const answering = Math.random() < 0.5
const correct = Math.random() < 0.5
const sealed = !answering && Math.random() < 0.5

const STATEMENT = 'Quel est le point culminant d\'Afrique ?'

const state = ref(demoState({
  phase: 'recovery',
  // Le rattrapage ne se joue qu'à zéro vie : c'est sa définition même.
  lives: 0,
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
    required: 3,
  },
  floorSeen: 544,
  floorTotal: 1000,
  streak: 12,
  seenTotal: 1_204,
  spellDiscovered: true,
  lessonsDone: ['camp'],
  effects: Array.from({ length: Math.floor(Math.random() * 3) }, () => randomEffect('active')),
}))

provideGameState(state)

// Le lien de contestation ne se propose que sur un verdict faux, comme en jeu.
const disputable = !answering && !correct

const view = computed(() => playView(state.value))
</script>
