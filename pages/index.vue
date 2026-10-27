<template>
  <div class="contents">
    <!-- `contents` : une seule racine pour la page, sans boîte pour la mise en
         page — les cartes restent les enfants directs du <main> du gabarit. -->
    <!-- Au-dessus de toute carte, dans la bande des succès : une action refusée
         doit se lire quel que soit l'écran en cours. -->
    <BaseToastStack v-if="disputeFailed || actionFailed || practice.failed.value">
      <BaseToast v-if="disputeFailed">
        La contestation n'est pas partie. Réessaie.
      </BaseToast>
      <BaseToast v-if="actionFailed || practice.failed.value">
        L'action a échoué. Réessaie.
      </BaseToast>
    </BaseToastStack>

    <!-- La question d'essai de la leçon du camp, puis son verdict : l'écran
         d'une question d'ascension, que l'état servi ne connaît pas — rien
         de la partie n'en dépend. Voir usePracticeQuestion. -->
    <QuestionCard
      v-if="practice.question.value && !practice.verdict.value && state && practiceScreen"
      :state="state"
      :question="practice.question.value"
      :model-value="practice.typed.value"
      :seconds-left="practice.secondsLeft.value"
      :submitting="practice.submitting.value"
      :effects="practiceScreen.activeEffects"
      :lesson="practice.line.value"
      @update:model-value="practice.typed.value = $event"
      @submit="practice.submit"
    />

    <!-- « Contester » s'y montre sur un faux, sans rien contester : Michel
         l'explique, c'est tout. -->
    <ResultCard
      v-else-if="practice.verdict.value && state && practiceScreen"
      :state="state"
      :screen="practiceScreen"
      :effects="practiceScreen.activeEffects"
      :action="{ label: 'Suivant', move: 'advance' }"
      :disputable="!practice.verdict.value.correct"
      :disputing="false"
      :advancing="isRunning('advance')"
      uncounted
      :lesson="practice.line.value"
      @advance="practice.leave"
    />

    <!-- `submitting` lit `pending` tout court : pendant une question, rien
         d'autre qu'une réponse ne peut être en vol, et celle que le chrono ou
         la perte de focus envoie se joue comme celle du bouton. -->
    <RecoveryCard
      v-else-if="view?.card === 'recovery'"
      :screen="view.screen"
      :action="view.action"
      :model-value="typed"
      :seconds-left="secondsLeft"
      :submitting="pending"
      :disputable="disputable"
      :disputing="disputing"
      :advancing="isRunning('advance')"
      @update:model-value="typed = $event"
      @submit="submit"
      @dispute="disputeVerdict"
      @advance="goNext"
    />

    <QuestionCard
      v-else-if="view?.card === 'question' && state"
      :state="state"
      :question="view.question"
      :model-value="typed"
      :seconds-left="secondsLeft"
      :submitting="pending"
      :effects="view.screen.activeEffects"
      @update:model-value="typed = $event"
      @submit="submit"
    />

    <CooldownCard
      v-else-if="view?.card === 'cooldown' && state"
      :state="state"
      :screen="view.screen"
      :action="view.action"
      :cooldown-remaining="cooldownRemaining"
      :loading="loading"
      :is-admin="isAdmin"
      :skipping="isRunning('skipCooldown')"
      :advancing="isRunning('advance')"
      :team="user?.team ?? null"
      :lesson="lesson.line.value"
      @skip-cooldown="run('skipCooldown', skipCooldown)"
      @advance="advanceFromCamp"
      @open="openCampOverlay"
    />

    <ChestCard
      v-else-if="view?.card === 'chest' && state"
      :state="state"
      :effects="view.screen.activeEffects"
      :chest="view.chest"
      :action="view.action"
      :opening="isRunning('chest')"
      :advancing="isRunning('advance')"
      @open="run('chest', openChest)"
      @advance="goNext"
    />

    <ResultCard
      v-else-if="view?.card === 'result' && state"
      :state="state"
      :screen="view.screen"
      :effects="view.screen.activeEffects"
      :action="view.action"
      :disputable="disputable"
      :disputing="disputing"
      :advancing="isRunning('advance')"
      @dispute="disputeVerdict"
      @advance="goNext"
    />

    <!-- Le palier, verdict lu : la porte du boss, puis son introduction. Au
         terme, le serveur ouvre le combat. -->
    <BossStage
      v-else-if="view?.card === 'bossDoor' && bossStage"
      :key="bossStage.floor"
      :stage="bossStage"
      @enter="enterBossFight"
    />

    <BossFightCard
      v-else-if="view?.card === 'bossFight' && state && bossStage"
      :lives="state.lives"
      :max-lives="state.maxLives"
      :boss="view.boss"
      :stage="bossStage"
      :player-name="user?.displayName ?? ''"
      :portrait="playerPortrait(user?.gender ?? null)"
      :model-value="typed"
      :seconds-left="secondsLeft"
      :submitting="pending"
      :action="view.action"
      :advancing="isRunning('advance')"
      @update:model-value="typed = $event"
      @submit="submit"
      @advance="goNext"
    />

    <BossOutro
      v-else-if="view?.card === 'bossOutro' && bossStage"
      :boss="bossStage.boss"
      :colors="bossStage.intro?.windowColors"
      @leave="goNext"
    />

    <BaseCard v-else>
      <BaseNotice v-if="readFailed">
        Impossible de lire ta partie. Recharge la page.
      </BaseNotice>
    </BaseCard>

    <!-- Le retour au camp depuis le jeu (ascension, coffre, rattrapage) : le
         camp sort d'un fondu au noir, au lieu de remplacer le cadre de jeu
         d'un coup. Hors de la chaîne des cartes, que `<Transition>` ne peut
         pas porter : le camp a plusieurs racines. Sans animation, pas de
         voile — il ne se retirerait jamais. -->
    <div
      v-if="campFade"
      class="pointer-events-none fixed inset-0 z-40 bg-slate-950 motion-safe:animate-camp-fade motion-reduce:hidden"
      @animationend="campFade = false"
    />

    <!-- Michel en leçon, sur le camp. Hors de la chaîne des cartes : glissé
         dedans, il la coupait, et la carte vide du `v-else` s'affichait à côté
         de la question. Quand une boîte du camp est ouverte, c'est
         elle qui le porte (l'Inventaire) : une boîte modale passerait devant. -->
    <MichelLesson
      v-if="view?.card === 'cooldown' && !practice.question.value && lesson.line.value && lesson.line.value.awaits !== 'pause' && !lesson.line.value.overlay && !campOverlay"
      :line="lesson.line.value"
      @next="lesson.next"
      @ascent="leaveForAscent"
    />

    <!-- Michel à la question d'essai : il se tait pendant que le joueur répond. -->
    <MichelLesson
      v-if="practice.line.value"
      :line="practice.line.value"
      @next="practice.next"
    />

    <!-- Les boîtes du camp — le Grimoire, le Volumen, les Haut-faits et
         l'Inventaire — s'ouvrent par-dessus lui, sans URL : le camp reste
         affiché dessous et son attente continue de tourner. Chaque boîte
         prévient quand elle a fini de se fermer, ou quand la partie quitte le
         camp (CampOverlay). -->
    <component
      :is="CAMP_OVERLAYS[campOverlay]"
      v-if="campOverlay"
      v-bind="lesson.line.value?.overlay === campOverlay ? { lesson: lesson.line.value } : {}"
      @close="closeCampOverlay"
      @next="lesson.next"
      @used="lesson.done('use')"
      @chosen="lesson.done('click')"
      @cast="lesson.done('cast')"
    />
  </div>
</template>

<script setup lang="ts">
import { AchievementsOverlay, InventoryOverlay, QuestionLogOverlay, SpellbookOverlay } from '#components'
import type { Component } from 'vue'
import type { CampOverlayId, PlayView } from '~~/utils/phase'

// Une seule route de jeu : le serveur décide de la phase, la page affiche
// celle-là. Le joueur ne choisit jamais son écran. Voir specs/ecrans.md.
// Le temps, les envois et les relectures vivent dans useQuestionRun().
const {
  state,
  now,
  typed,
  secondsLeft,
  cooldownRemaining,
  submit,
  advance,
  enterBoss,
  skipCooldown,
  openChest,
  pending,
  actionFailed,
  readFailed,
  loading,
  refresh,
} = await useQuestionRun()

// L'admin peut passer l'attente de la partie qu'il regarde — la sienne, ou
// celle du joueur test qu'il incarne. Le bouton ne se montre qu'à lui.
const { user, isAdmin } = await useCurrentUser()

// Les infobulles des sorts y lisent les vies et l'échéance de l'attente.
provideGameState(state)

// Le bouton exact sur lequel on vient de cliquer : `pending` est vrai pour toute
// la page, il ferait tourner « Commencer » pendant qu'un admin passe l'attente
// juste au-dessus.
type PendingButton = 'advance' | 'skipCooldown' | 'chest'
const running = ref<PendingButton | null>(null)

function isRunning(action: PendingButton): boolean {
  return pending.value && running.value === action
}

async function run(action: PendingButton, move: () => Promise<void>): Promise<void> {
  running.value = action
  await move()
  running.value = null
}

// La contestation se propose à deux endroits : sur le verdict, au moment où le
// désaccord naît, et sur la fiche de révision du pool. Voir specs/validation.md.
const { isDisputable, sendDispute, disputingId, refresh: refreshDisputes } = useDisputes()
const disputeFailed = ref(false)

const verdictId = computed(() => view.value?.screen.verdict?.questionId ?? null)
const disputable = computed(() => verdictId.value !== null && isDisputable(verdictId.value))
const disputing = computed(() => verdictId.value !== null && disputingId.value === verdictId.value)

async function disputeVerdict(): Promise<void> {
  if (verdictId.value !== null) {
    disputeFailed.value = !(await sendDispute(verdictId.value))
  }
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

// Deux allers purement client, que le serveur ignore : l'écran du coffre, ouvert
// depuis le verdict quand un coffre attend, et la chute, lue avant le poster.
// Quelle carte en découle se décide dans utils/phase.ts (playView), testé : la
// page ne fait qu'exécuter.
const chestOf = ref<string | null>(null)
const fallenOn = ref<string | null>(null)
// La fin d'un combat de boss, lue avant la phase d'après (l'outro de la
// défaite, la victoire du dernier étage) : un troisième aller client, armé
// comme la chute.
const bossEndOn = ref<string | null>(null)

const view = computed(() =>
  state.value
    ? playView(state.value, { chestOf: chestOf.value, fallenOn: fallenOn.value, bossEndOn: bossEndOn.value })
    : null,
)

/** Le boss de l'étage, sa porte et son introduction. */
const bossStage = computed(() => state.value && bossStageOf(state.value.floor))

// Le jeu qui rend la main au camp : voir le voile `campFade` du gabarit. Pas au
// chargement (aucune carte avant), ni depuis la question d'essai, jouée sur le
// camp sans le quitter.
const campFade = ref(false)
const PLAY_CARDS = new Set<PlayView['card']>(['question', 'result', 'chest', 'recovery', 'bossOutro'])

watch(() => view.value?.card, (card, previous) => {
  if (card === 'cooldown' && previous && PLAY_CARDS.has(previous)) {
    campFade.value = true
  }
})

// Armé sur l'id, pas l'objet : une relecture rend le même verdict dans un nouvel
// objet et le rouvrirait. Sans `immediate` : une page rechargée en pleine
// attente va droit au poster.
//
// Une seule fois par chute. La chute lue s'oublie dès qu'il n'y a plus de
// verdict (une question est servie) : une nouvelle chute sur la même question
// se lirait à nouveau.
// Une chute déjà là au chargement compte comme lue : c'est le poster qui s'affiche.
let lastFallId = state.value && fallQuestionId(state.value)
watch(() => state.value?.verdict?.questionId, (questionId) => {
  if (!questionId) {
    lastFallId = null
  }

  const held = state.value && fallQuestionId(state.value)
  if (held && held !== lastFallId) {
    lastFallId = held
    fallenOn.value = held
  }
})

// La fin du combat, comme la chute : une seule fois, et pas au chargement —
// une page rechargée va droit au poster, ou à la fin de partie.
let lastBossEnd = state.value && bossEndId(state.value)
watch(() => state.value && bossEndId(state.value), (ended) => {
  if (ended && ended !== lastBossEnd) {
    lastBossEnd = ended
    bossEndOn.value = ended
  }
})

// La boîte du camp ouverte, null quand aucune ne l'est.
const campOverlay = ref<CampOverlayId | null>(null)

/** Ce que monte chaque boîte du camp. */
const CAMP_OVERLAYS: Record<CampOverlayId, Component> = {
  spellbook: SpellbookOverlay,
  questionLog: QuestionLogOverlay,
  achievements: AchievementsOverlay,
  inventory: InventoryOverlay,
}

// Michel au camp : chaque leçon à son moment, une fois. Une leçon
// datée relit l'état, qui dit la suivante. Voir specs/ecrans.md#leçons-de-michel.
const lesson = useCampLesson(state, computed(() => user.value?.team ?? null), refresh)

/** Un objet du camp cliqué : en leçon, c'est peut-être le geste que Michel attendait. */
function openCampOverlay(screen: CampOverlayId): void {
  campOverlay.value = screen
  lesson.done('click')
}

/** Une boîte du camp refermée : en leçon, c'est peut-être ce que Michel venait de demander. */
function closeCampOverlay(): void {
  campOverlay.value = null
  lesson.done('close')
}

/**
 * La corde, ou « Commencer » : la suite de la partie. En leçon, seule la corde
 * répond, et Michel dit au revoir avant que l'ascension parte.
 */
function advanceFromCamp(): void {
  if (lesson.line.value) {
    lesson.done('click')
  }
  else {
    void goNext()
  }
}

// La question d'essai, que la leçon du camp pose après l'au revoir de Michel.
// « Suivant » tire la première vraie question : tirée quand l'état en sert une.
// Voir specs/ecrans.md#leçons-de-michel.
const practice = usePracticeQuestion({
  now,
  advance: async () => {
    await goNext()
    return Boolean(state.value?.question)
  },
})

/** L'écran de l'essai : la partie telle qu'elle est, et le verdict de l'essai. */
const practiceScreen = computed(() => view.value && { ...view.value.screen, verdict: practice.verdict.value })

/**
 * Le clic sur l'au revoir de Michel : la question d'essai se lit d'abord, puis
 * la leçon du camp est vue. Dans cet ordre, Michel et son ombre tiennent le
 * camp jusqu'à ce que l'essai le remplace : ni la corde ni Entrée ne tirent la
 * vraie question entre les deux.
 */
async function leaveForAscent(): Promise<void> {
  await practice.start()
  await lesson.finish()
}

// Entrée enchaîne : la même touche qui envoie une réponse fait passer au verdict
// suivant. Jamais pendant qu'une question tourne — là, la carte n'a pas d'action
// et Entrée répond.
// Ni quand une boîte du camp est ouverte : Entrée y lirait, pas remonter. Ni
// pendant que Michel parle : Entrée fait avancer sa bulle, et une leçon ne se
// passe pas.
useAdvanceOnEnter(goNext, () => Boolean(view.value?.action) && campOverlay.value === null && !lesson.line.value && !practice.question.value)

// Au verdict de la question d'essai, Entrée fait « Suivant » — une fois Michel tu.
useAdvanceOnEnter(practice.leave, () => Boolean(practice.verdict.value) && !practice.line.value)

// Le seul point d'entrée pour « avancer », bouton comme Entrée : le geste vient
// de playView, la page l'exécute.
async function goNext(): Promise<void> {
  const action = view.value?.action

  switch (action?.move) {
    case 'leave':
      fallenOn.value = null
      chestOf.value = null
      bossEndOn.value = null
      return
    case 'enterChest':
      chestOf.value = action.chestOf
      return
    case 'advance':
      // Seul l'aller serveur attend la fin d'un envoi en vol : entrer dans le
      // coffre ou quitter la chute ne demandent rien à personne.
      if (!pending.value) {
        await run('advance', advance)
      }
  }
}

/** « Entrer », au terme de l'introduction : le serveur ouvre le combat. */
async function enterBossFight(): Promise<void> {
  if (!pending.value) {
    await run('advance', enterBoss)
  }
}
</script>
