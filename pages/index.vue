<template>
  <div class="contents">
    <!-- `contents` : une seule racine pour la page, sans boîte pour la mise en
         page — les cartes restent les enfants directs du <main> du gabarit. -->
    <!-- Au-dessus de toute carte, dans la bande des succès : une action refusée
         doit se lire quel que soit l'écran en cours. -->
    <BaseToastStack v-if="disputeFailed || actionFailed">
      <BaseToast v-if="disputeFailed">
        La contestation n'est pas partie. Réessaie.
      </BaseToast>
      <BaseToast v-if="actionFailed">
        L'action a échoué. Réessaie.
      </BaseToast>
    </BaseToastStack>

    <!-- `submitting` lit `pending` tout court : pendant une question, rien
         d'autre qu'une réponse ne peut être en vol, et celle que le chrono ou
         la perte de focus envoie se joue comme celle du bouton. -->
    <RecoveryCard
      v-if="view?.card === 'recovery'"
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
      @skip-cooldown="run('skipCooldown', skipCooldown)"
      @advance="goNext"
      @open="campOverlay = $event"
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

    <BaseCard v-else>
      <BaseNotice v-if="readFailed">
        Impossible de lire ta partie. Recharge la page.
      </BaseNotice>
    </BaseCard>

    <!-- Les boîtes du camp — le Grimoire, le Volumen, les Haut-faits et
         l'Inventaire — s'ouvrent par-dessus lui, sans URL : le camp reste
         affiché dessous et son attente continue de tourner. Chaque boîte
         prévient quand elle a fini de se fermer, ou quand la partie quitte le
         camp (CampOverlay). -->
    <component :is="CAMP_OVERLAYS[campOverlay]" v-if="campOverlay" @close="campOverlay = null" />
  </div>
</template>

<script setup lang="ts">
import { AchievementsOverlay, InventoryOverlay, QuestionLogOverlay, SpellbookOverlay } from '#components'
import type { Component } from 'vue'
import type { CampOverlayId } from '~~/utils/phase'

// Une seule route de jeu : le serveur décide de la phase, la page affiche
// celle-là. Le joueur ne choisit jamais son écran. Voir specs/ecrans.md.
// Le temps, les envois et les relectures vivent dans useQuestionRun().
const {
  state,
  typed,
  secondsLeft,
  cooldownRemaining,
  submit,
  advance,
  skipCooldown,
  openChest,
  pending,
  actionFailed,
  readFailed,
  loading,
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

const view = computed(() =>
  state.value
    ? playView(state.value, { chestOf: chestOf.value, fallenOn: fallenOn.value })
    : null,
)

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

// La boîte du camp ouverte, null quand aucune ne l'est.
const campOverlay = ref<CampOverlayId | null>(null)

/** Ce que monte chaque boîte du camp. */
const CAMP_OVERLAYS: Record<CampOverlayId, Component> = {
  spellbook: SpellbookOverlay,
  questionLog: QuestionLogOverlay,
  achievements: AchievementsOverlay,
  inventory: InventoryOverlay,
}

// Entrée enchaîne : la même touche qui envoie une réponse fait passer au verdict
// suivant. Jamais pendant qu'une question tourne — là, la carte n'a pas d'action
// et Entrée répond.
// Ni quand une boîte du camp est ouverte : Entrée y lirait, pas remonter.
useAdvanceOnEnter(goNext, () => Boolean(view.value?.action) && campOverlay.value === null)

// Le seul point d'entrée pour « avancer », bouton comme Entrée : le geste vient
// de playView, la page l'exécute.
async function goNext(): Promise<void> {
  const action = view.value?.action

  switch (action?.move) {
    case 'leave':
      fallenOn.value = null
      chestOf.value = null
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
</script>
