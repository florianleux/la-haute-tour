<template>
  <BaseDialog
    ref="dialog"
    label="Volumen"
    class="question-log-scroll-metrics items-start justify-center overflow-clip bg-slate-950/40 backdrop-blur-xs"
    :class="closing ? 'motion-safe:animate-fade-out [--enter-delay:0.25s]' : 'motion-safe:animate-fade-in'"
    @close="close"
  >
    <!-- Par-dessus le camp, flouté dessous : la page de jeu n'est jamais
         démontée, le Volumen est sa route enfant. Clic à côté du papier =
         fermer, y compris dans les vides de l'image autour des rouleaux : les
         deux couches du parchemin laissent passer le clic jusqu'à cette boîte,
         que le papier, lui, arrête.

         Le bas du parchemin — bord du papier et rouleaux — tombe sous l'écran :
         seules les poignées du haut se voient, et le papier descend jusqu'en bas
         pour laisser plus de place à la lecture. En largeur, le calque est
         rogné au ras des rouleaux : ils se posent à 4 % des bords de l'écran,
         quelle que soit la largeur. Repères du calque :
         `question-log-scroll-metrics`, dans main.css. `overflow-clip` et non `hidden` : une
         boîte `hidden` se fait défiler par le navigateur pour montrer ce qui
         prend le focus, et décalait tout le parchemin vers le haut. -->
    <div
      class="relative mt-[6dvh] h-[round(calc(94dvh+var(--k)*var(--cut-b)),1px)] w-[round(92vw,1px)] shrink-0 origin-bottom"
      :class="closing ? 'motion-safe:animate-sink [--enter-delay:0.12s]' : 'motion-safe:animate-rise'"
      @click.self="close"
    >
      <!-- Le parchemin monte roulé (rise, sur cette boîte) et commence à se
           dérouler en pleine montée, bien avant d'être posé : d'où le délai
           des deux couches qui suivent.
           Le parchemin et son rouleau gauche, dévoilés de gauche à droite… -->
      <div
        class="question-log-scroll pointer-events-none absolute inset-0 [--enter-delay:0.15s]"
        :class="closing ? 'motion-safe:animate-roll-up' : 'motion-safe:animate-unroll'"
      />
      <!-- …pendant que le rouleau droit, seul, glisse depuis le gauche. Ses
           rebonds le font osciller autour de sa poignée du haut. -->
      <div
        class="question-log-scroll pointer-events-none absolute inset-0 origin-[calc(100%-var(--k)*var(--rod-r))_calc(var(--k)*var(--cap-y))] [--enter-delay:0.15s] [clip-path:inset(0_0_0_calc(100%-var(--k)*(var(--rod-r)+var(--rod-w)/2)))]"
        :class="closing ? 'motion-safe:animate-roll-up-rod' : 'motion-safe:animate-unroll-rod'"
      />

      <!-- Le papier attrape ses clics : seuls les vides autour des rouleaux
           ferment. Il couvre d'un rouleau à l'autre, du haut du papier au bas
           de la boîte. -->
      <div class="absolute inset-x-0 top-[calc(var(--k)*var(--paper-y))] bottom-0" />

      <!-- Le titre, posé au-dessus du papier entre les deux poignées, dans
           l'éclat des noms du camp. Il jaillit pendant le déroulé, quand le
           bord du papier passe sous lui, au milieu, avec le même rebond que le
           verdict juste (animate-cheer). -->
      <h1
        class="absolute left-1/2 top-[calc(var(--k)*var(--paper-y))] -translate-x-1/2 -translate-y-full origin-bottom pb-[0.2em] text-[max(3rem,8dvh)]"
        :class="closing ? 'motion-safe:animate-fade-out [--enter-delay:0s]' : 'motion-safe:animate-cheer [--enter-delay:0.3s]'"
      >
        <BaseGlowLabel soft>
          Volumen
        </BaseGlowLabel>
      </h1>

      <!-- Le papier : de quoi lire, une fois déroulé, et ré-enroulé avec lui
           à la fermeture. -->
      <div
        class="absolute inset-x-[calc(var(--k)*var(--text-x))] top-[calc(var(--k)*var(--cut-t))] bottom-[calc(var(--k)*var(--cut-b)+1.5rem)] flex flex-col"
        :class="closing ? 'motion-safe:animate-roll-up-text' : 'motion-safe:animate-fade-in [--enter-delay:0.95s]'"
      >
        <div class="flex items-start justify-between gap-4">
          <p class="text-sm text-amber-900/70">
            Les questions que tu as croisées dans la Tour, avec leurs réponses.
            Relis celles qui t'ont échappé : le rattrapage les tire dans ce que tu as à revoir.
          </p>
          <BaseIconButton label="Fermer le Volumen" @click="close">
            <path d="M6.4 5 12 10.6 17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6L6.4 19 5 17.6l5.6-5.6L5 6.4 6.4 5Z" />
          </BaseIconButton>
        </div>

        <!-- Les listes portent encore le thème sombre : elles se lisent sur une
             ardoise posée sur le papier, en attendant leur version parchemin. -->
        <div class="mt-4 min-h-0 flex-1 overflow-y-auto rounded-xl bg-slate-950/85 p-4 text-slate-100">
          <BaseTabs v-model="tab" :tabs="tabs" />

          <!-- Chaque onglet garde sa page quand on passe à un autre et qu'on revient. -->
          <KeepAlive>
            <QuestionLogList :key="tab" :tab="tab" class="mt-6" />
          </KeepAlive>
        </div>
      </div>
    </div>
  </BaseDialog>
</template>

<script setup lang="ts">
// Le journal des questions vues, au camp et là seulement : le rattrapage tire
// dans le Pool Échecs, en lire les réponses pendant qu'il tourne serait tricher.
// Voir specs/ecrans.md#volumen.
import { isNavigationFailure, NavigationFailureType } from 'vue-router'
import type { QuestionLogTab } from '~/composables/useQuestionLog'

definePageMeta({
  // Hors du camp, la page n'est pas atteignable — URL comprise. Le serveur
  // refuse déjà la lecture. Voir middleware/camp.ts.
  middleware: 'camp',
})

const tabs: { id: QuestionLogTab, label: string }[] = [
  { id: 'missed', label: 'À revoir' },
  { id: 'correct', label: 'Sues' },
  { id: 'all', label: 'Toutes' },
]

const tab = ref<QuestionLogTab>('missed')

// Le bouton de contestation ne s'affiche que sur ce que le serveur dit
// contestable : la liste se lit en arrivant.
const { refresh } = useDisputes()
onMounted(refresh)

const closing = ref(false)

// Fermer, c'est revenir au camp : un détour, pas une étape — croix, Échap, clic
// à côté. Pendant la sortie, un second geste — ou le retour du navigateur —
// lance une autre navigation : elle attend la même sortie au lieu de la couper.
function close(): void {
  if (!closing.value) {
    void navigateTo('/')
  }
}

// Le middleware ne garde que l'entrée : la partie peut quitter le camp pendant
// la lecture — attente échue, rattrapage tiré dans un autre onglet. Le Volumen
// se ferme alors de lui-même. Un changement fait ailleurs ne se voit qu'en
// relisant : on relit au retour sur l'onglet. Voir specs/ecrans.md#volumen.
const { state, refresh: refreshGame } = await useGameState()
watch(state, (now) => {
  if (!isAtCamp(now)) {
    close()
  }
})

function onVisible(): void {
  if (document.visibilityState === 'visible') {
    void refreshGame()
  }
}

onMounted(() => document.addEventListener('visibilitychange', onVisible))
onUnmounted(() => document.removeEventListener('visibilitychange', onVisible))

// Quelle que soit la sortie, le parchemin se ré-enroule et redescend avant que
// la route change. La route attend la fin des animations elles-mêmes, pas une
// durée recopiée de main.css ; sans animation (mouvement réduit), elle part
// tout de suite. Les étincelles du titre tournent en boucle : elles ne comptent
// pas. Une seule sortie à la fois : toute navigation qui part pendant ce temps
// attend la même.
const dialog = useTemplateRef<{ element: HTMLDialogElement | null }>('dialog')
const EXIT_CEILING_MS = 1000
let exit: Promise<unknown> | null = null

async function playExit(): Promise<void> {
  closing.value = true
  await nextTick()

  const exits = (dialog.value?.element?.getAnimations({ subtree: true }) ?? [])
    .filter(animation => animation.effect?.getTiming().iterations !== Infinity)

  // allSettled : une animation remplacée en route rejette sa promesse. Le
  // plafond : dans un onglet masqué, le navigateur ne fait pas avancer les
  // animations — une fermeture lancée par la partie (attente échue) y
  // bloquerait la navigation jusqu'au retour du joueur.
  await Promise.race([
    Promise.allSettled(exits.map(animation => animation.finished)),
    new Promise(resolve => setTimeout(resolve, EXIT_CEILING_MS)),
  ])
}

onBeforeRouteLeave(async () => {
  exit ??= playExit()
  await exit
})

// Une sortie refusée en route (une garde qui dit non, une erreur) laisserait
// une boîte invisible, mais modale : toute la page inerte. Le Volumen se rouvre
// alors. Une navigation seulement remplacée par une autre, elle, continue la
// même sortie.
const stopWatchingFailures = useRouter().afterEach((_to, _from, failure) => {
  if (isNavigationFailure(failure, NavigationFailureType.aborted)) {
    exit = null
    closing.value = false
  }
})
onUnmounted(stopWatchingFailures)
</script>
