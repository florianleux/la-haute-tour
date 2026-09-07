<template>
  <BaseCard v-if="state?.recoveryResult === 'resumed'" title="Rattrapage réussi">
    <template #lead>
      Tes vies sont restaurées. Tu peux reprendre l'ascension.
    </template>
    <BaseButton block class="mt-8" :loading="isRunning('advance')" @click="run('advance', advance)">
      Reprendre l'ascension
    </BaseButton>
  </BaseCard>

  <TowerQuestionCard
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

  <TowerWaitCard
    v-else-if="waiting && state && screen"
    :state="state"
    :screen="screen"
    :wait-remaining="waitRemaining"
    :loading="loading"
    :is-admin="isAdmin"
    :skipping="isRunning('skipCooldown')"
    :advancing="isRunning('advance')"
    @skip-cooldown="run('skipCooldown', skipCooldown)"
    @advance="run('advance', advance)"
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

      <BaseHint v-if="screen.recovery">
        Rattrapage — question {{ screen.recovery.position }}
        sur {{ screen.recovery.total }},
        {{ screen.recovery.successes }} juste(s).
      </BaseHint>

      <!-- Le joueur compte ses questions : sans cette ligne, un rattrapage plus
           long qu'à l'ordinaire passe pour un bug. Voir specs/bonus.md#catalogue. -->
      <BaseHint v-if="screen.recovery?.lengthened" tone="success">
        Une Indulgence rallonge ce rattrapage : plus de questions tirées, donc
        plus d'occasions de retrouver tes vies.
      </BaseHint>

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

      <!-- Le verdict se lit dans toutes les phases : la question qui a fini
           l'étage ou coûté la dernière vie est celle dont la réponse reste à
           découvrir. Le palier et la fin s'affichent par-dessus, pas à sa place. -->
      <template v-if="screen.verdict">
        <BaseHeadline class="mt-6" :tone="screen.verdict.correct ? 'success' : 'danger'">
          {{ screen.verdict.correct ? 'Juste !' : 'Faux.' }}
        </BaseHeadline>
        <BaseHint class="mt-2">
          Réponse : <AnswerLabel :label="screen.verdict.answerLabel" />
        </BaseHint>
        <BaseHint class="mt-1">
          Ta réponse : {{ screen.verdict.submittedAnswer || '(rien)' }}
        </BaseHint>
        <BaseHint v-if="screen.verdict.lifeLost" class="mt-1" tone="danger">
          Tu perds une vie.
        </BaseHint>

        <!-- Un joueur honnête doit pouvoir comprendre, plutôt que de croire à un
             bug. Voir specs/anti-triche.md#perte-de-focus. -->
        <BaseHint v-if="leftThePage" class="mt-3" tone="warning">
          Tu as quitté la page : ta réponse a été envoyée en l'état.
        </BaseHint>

        <!-- Le désaccord se dit ici, au moment où il naît. L'écran de verdict
             n'est pas chronométré : contester n'ouvre aucune brèche. -->
        <BaseButton
          v-if="isContestable(screen.verdict.questionId)"
          variant="ghost"
          class="mt-3"
          :loading="contestingId === screen.verdict.questionId"
          @click="dispute(screen.verdict.questionId)"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="h-4 w-4" aria-hidden="true">
            <path d="M3 10v4a1 1 0 0 0 1 1h2l4 4V5L6 9H4a1 1 0 0 0-1 1Zm10.5-4.5a1 1 0 0 0-1.4 0l-.6.6a1 1 0 0 0 0 1.4 5 5 0 0 1 0 7l.6.6a1 1 0 0 0 1.4 0l.6-.6a1 1 0 0 0 0-1.4 3 3 0 0 1 0-4.2l-.6-.6a1 1 0 0 0 0-1.4Z" />
          </svg>
          Contester cette question
        </BaseButton>

        <!-- Le coffre, en bas du verdict. L'ouvrir est un clic distinct de
             « suivant » : tant qu'il est fermé, rien d'autre n'avance.
             Voir specs/bonus.md#coffre-et-mimic. -->
        <template v-if="screen.chest">
          <BaseButton
            v-if="!screen.chest.opened"
            block
            class="mt-6"
            :loading="isRunning('chest')"
            @click="run('chest', openChest)"
          >
            Ouvrir le coffre
          </BaseButton>
          <ChestResult v-else :chest="screen.chest" class="mt-6" />
        </template>

        <!-- Le résultat du rattrapage s'annonce à la fin, pas question par question. -->
        <BaseHint
          v-if="screen.recovery?.result"
          class="mt-3"
          :tone="screen.recovery.result === 'resumed' ? 'success' : 'warning'"
        >
          {{ screen.recovery.result === 'resumed'
            ? 'Rattrapage réussi : tes vies sont restaurées.'
            : 'Aucune bonne réponse : une nouvelle attente commence.' }}
        </BaseHint>
      </template>

      <!-- Palier : l'étage est bouclé. Le franchir est ce qui incrémente
           l'étage, donc un rafraîchissement rejoue cet écran au lieu de le
           sauter. Voir specs/mecanique.md#fin-détage. -->
      <template v-if="screen.phase === 'floorEnd'">
        <BaseHeadline class="mt-6">
          Étage {{ state.floor }} terminé.
        </BaseHeadline>
        <BaseHint class="mt-2">
          Tu as vu toutes ses questions. Ce que tu y as raté reste à cet étage :
          le suivant repart d'une fiche vierge.
        </BaseHint>
      </template>

      <!-- Fin de partie : phase terminale, sans classement. -->
      <template v-else-if="screen.phase === 'gameOver'">
        <BaseHeadline class="mt-6" tone="success">
          Tu as fini La Haute Tour.
        </BaseHeadline>
        <BaseHint class="mt-2">
          Tous les étages sont derrière toi. Bravo.
        </BaseHint>
      </template>

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
useAdvanceOnEnter(canAdvance, () => run('advance', advance))

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

</script>
