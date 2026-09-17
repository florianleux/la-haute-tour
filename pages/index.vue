<template>
  <RecoveryCard
    v-if="state?.phase === 'recovery' && screen && (screen.question || screen.verdict)"
    :screen="screen"
    :model-value="typed"
    :seconds-left="secondsLeft"
    :submitting="isRunning('submit')"
    :contestable="Boolean(screen.verdict && isContestable(screen.verdict.questionId))"
    :contesting="Boolean(screen.verdict && contestingId === screen.verdict.questionId)"
    :advancing="isRunning('advance')"
    @update:model-value="typed = $event"
    @submit="run('submit', submit)"
    @dispute="screen.verdict && dispute(screen.verdict.questionId)"
    @advance="goNext"
  />

  <QuestionCard
    v-else-if="state?.phase === 'ascent' && screen?.question"
    :state="state"
    :question="screen.question"
    :model-value="typed"
    :seconds-left="secondsLeft"
    :submitting="isRunning('submit')"
    :effects="screen.activeEffects"
    @update:model-value="typed = $event"
    @submit="run('submit', submit)"
  />

  <WaitCard
    v-else-if="waiting && state && screen"
    :state="state"
    :screen="screen"
    :wait-remaining="waitRemaining"
    :loading="loading"
    :is-admin="isAdmin"
    :skipping="isRunning('skipCooldown')"
    :advancing="isRunning('advance')"
    @skip-cooldown="run('skipCooldown', skipCooldown)"
    @advance="goNext"
  />

  <ChestCard
    v-else-if="viewingChest && state && screen && screen.chest"
    :chest="screen.chest"
    :action="screen.action"
    :opening="isRunning('chest')"
    :advancing="isRunning('advance')"
    @open="openTheChest"
    @advance="goNext"
  />

  <ResultCard
    v-else-if="state && screen && (screen.verdict || screen.phase === 'floorEnd' || screen.phase === 'gameOver')"
    :state="state"
    :screen="screen"
    :effects="screen.activeEffects"
    :contestable="Boolean(screen.verdict && isContestable(screen.verdict.questionId))"
    :contesting="Boolean(screen.verdict && contestingId === screen.verdict.questionId)"
    :left-the-page="leftThePage"
    :advancing="isRunning('advance')"
    @dispute="screen.verdict && dispute(screen.verdict.questionId)"
    @enter-chest="viewingChest = true"
    @advance="goNext"
  />

  <BaseCard v-else>
    <BaseNotice v-if="readFailed">
      Impossible de lire ta partie. Recharge la page.
    </BaseNotice>

    <template v-if="state && screen">
      <div v-if="state.phase === 'ascent'" class="grid grid-cols-3 gap-3">
        <BaseStat label="Étage" :value="state.floor" />
        <BaseStat label="Vies" :value="state.lives" />
        <BaseStat label="Tentative" :value="state.attemptSeen" />
      </div>

      <BaseHint v-if="state.phase === 'ascent'" class="mt-2">
        Étage {{ state.floor }} — question {{ state.question ? state.floorSeen + 1 : state.floorSeen }} / {{ state.floorTotal }}
      </BaseHint>

      <!-- Une icône par effet actif : un joueur dont les chiffres ont changé
           doit pouvoir comprendre pourquoi plutôt que de croire à un bug.
           C'est un état, comme les vies — pas une action. -->
      <EffectList v-if="screen.activeEffects.length" :effects="screen.activeEffects" class="mt-3" />

      <!-- Le décompte du rattrapage et la mention de l'Indulgence vivent dans
           RecoveryCard, qui porte cette phase en entier. -->

      <!-- Question en cours : aucune action à part répondre. -->
      <form v-if="screen.question" class="mt-6" @submit.prevent="run('submit', submit)">
        <!-- Le joueur sait avant de répondre que ce passage vaut un coffre.
             Voir specs/bonus.md#question-loot. -->
        <BaseHint v-if="screen.question.lootQuestion" class="mb-3" tone="success">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="mr-1 inline h-4 w-4 align-text-bottom" aria-hidden="true">
            <path d="M20 7h-2.2a3 3 0 0 0-4.3-4A3 3 0 0 0 12 4.2 3 3 0 0 0 10.5 3a3 3 0 0 0-4.3 4H4a1 1 0 0 0-1 1v3h8V7h2v4h8V8a1 1 0 0 0-1-1ZM9 5a1 1 0 1 1 0 2H8.4L9 5Zm6 0 .6 2H15a1 1 0 1 1 0-2ZM4 13h7v8H5a1 1 0 0 1-1-1v-7Zm9 8v-8h7v7a1 1 0 0 1-1 1h-6Z" />
          </svg>
          Question loot — réponds juste et tu ouvres un coffre.
        </BaseHint>
        <BaseHeadline weight="light">{{ screen.question.statement }}</BaseHeadline>
        <BaseHint class="mt-2">
          {{ secondsLeft }} s
        </BaseHint>
        <!-- Le champ prend le clavier dès que la question paraît : Entrée envoie
             la réponse, puis enchaîne, et on ne sort jamais du clavier entre deux
             questions. Voir specs/ecrans.md#jeu. -->
        <BaseInput
          v-model="typed"
          autofocus
          label="Ta réponse"
          class="mt-4"
        />
        <BaseButton block class="mt-4" :loading="isRunning('submit')" @click="run('submit', submit)">
          Répondre
        </BaseButton>
      </form>

      <!-- Verdict, palier et fin de partie vivent dans ResultCard, plus haut
           dans cette page : hors de ce fallback, jamais atteints ici. -->
      <BaseButton
        v-if="screen.action"
        block
        class="mt-6"
        :loading="isRunning('advance')"
        @click="run('advance', advance)"
      >
        {{ screen.action }}
      </BaseButton>
    </template>

    <BaseNotice v-if="contestFailed">
      La contestation n'est pas partie. Réessaie.
    </BaseNotice>
    <BaseNotice v-if="actionFailed">
      L'action a échoué. Réessaie.
    </BaseNotice>
  </BaseCard>
</template>

<script setup lang="ts">
// Une seule route de jeu : le serveur décide de la phase, la page affiche
// celle-là. Le joueur ne choisit jamais son écran. Voir specs/ecrans.md.
// Le temps, les envois et les relectures vivent dans useQuestionRun().
const {
  state,
  typed,
  secondsLeft,
  waitRemaining,
  submit,
  advance,
  skipCooldown,
  openChest,
  pending,
  leftThePage,
  actionFailed,
  readFailed,
  loading,
} = await useQuestionRun()

// L'admin peut passer l'attente de la partie qu'il regarde — la sienne, ou
// celle du joueur test qu'il incarne. Le bouton ne se montre qu'à lui.
const { isAdmin } = await useCurrentUser()

// Ce que la carte montre se décide en un seul endroit, testable : la page ne
// fait que projeter cette décision. Voir utils/phase.ts.
const screen = computed(() => (state.value ? gameScreen(state.value) : null))

// Le bouton exact sur lequel on vient de cliquer : `pending` est vrai pour toute
// la page, il ferait tourner « Commencer le rattrapage » pendant qu'un admin
// passe l'attente juste au-dessus.
type PlayAction = 'submit' | 'advance' | 'skipCooldown' | 'chest'
const running = ref<PlayAction | null>(null)

// L'écran de coffre (ChestCard) est un aller purement client, ouvert
// depuis le verdict quand un coffre attend — jamais depuis le serveur.
const viewingChest = ref(false)

function isRunning(action: PlayAction): boolean {
  return pending.value && running.value === action
}

async function run(action: PlayAction, move: () => Promise<void>): Promise<void> {
  running.value = action
  await move()
  running.value = null
}

// Entrée enchaîne : la même touche qui envoie une réponse fait passer au verdict
// suivant. Jamais pendant qu'une question tourne — là, Entrée répond.
const canAdvance = computed(() => Boolean(screen.value?.action) && !screen.value?.question && !pending.value)
useAdvanceOnEnter(goNext, canAdvance)

// La contestation se propose à deux endroits : sur le verdict, au moment où le
// désaccord naît, et sur la fiche de révision du pool. Voir specs/validation.md.
const { isContestable, contest, contestingId, refresh: refreshDisputes } = useDisputes()
const contestFailed = ref(false)

async function dispute(questionId: string): Promise<void> {
  contestFailed.value = !(await contest(questionId))
}

// Les contestables se chargent au montage : useDisputes ne fetch plus à la
// création (plus de useAsyncData), il faut relire explicitement pour que les
// boutons « Contester » soient visibles dès l'arrivée sur la page.
refreshDisputes()

// Un verdict qui vient d'arriver n'est pas encore dans la liste des contestables
// — celle-ci a été lue avant la réponse. On la relit dès qu'un verdict faux
// apparaît, pour que le bouton « Contester » soit visible immédiatement.
watch(() => state.value?.verdict, (verdict) => {
  if (verdict && !verdict.correct) {
    refreshDisputes()
  }
})

// L'écran d'attente sert aussi au rattrapage prêt à démarrer : même fiche de
// révision, même file de contestation, mais le compteur cède la place au
// bouton « Commencer le rattrapage ». Voir specs/ecrans.md#cooldown--attente.
const waiting = computed(() =>
  state.value?.phase === 'cooldown'
  || (state.value?.phase === 'recovery' && !state.value.question && !state.value.recovery),
)

// Le seul chemin qui entre ici avec viewingChest à vrai est ChestCard une
// fois le coffre ouvert — refermer l'écran est donc toujours correct, quelle
// que soit la destination (nouvelle question, palier, fin de partie). Couvre
// aussi le raccourci Entrée (useAdvanceOnEnter), qui n'a qu'un seul point
// d'entrée pour « avancer ».
async function goNext(): Promise<void> {
  await run('advance', advance)
  viewingChest.value = false
}

async function openTheChest(): Promise<void> {
  await run('chest', openChest)
  // Un Mimic bascule directement en attente — WaitCard le montre, pas cet
  // écran. Rien à révéler ici dans ce cas : on referme derrière soi.
  // Voir specs/bonus.md#coffre-et-mimic.
  if (waiting.value) {
    viewingChest.value = false
  }
}
</script>
