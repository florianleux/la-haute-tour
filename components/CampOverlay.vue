<template>
  <!-- Par-dessus le camp, flouté dessous. Clic sur ce fond = fermer ; le
       contenu, posé par l'appelant, arrête les clics qu'il veut garder.
       `overflow-clip` et non `hidden` : une boîte `hidden` se fait défiler par
       le navigateur pour montrer ce qui prend le focus, et décalait tout le
       contenu vers le haut. -->
  <BaseDialog
    ref="dialog"
    :label="label"
    class="items-start justify-center overflow-clip bg-slate-950/40 backdrop-blur-xs"
    :class="closing ? 'motion-safe:animate-fade-out [--enter-delay:0.25s]' : 'motion-safe:animate-fade-in'"
    @close="close"
  >
    <slot :closing="closing" :close="close" />
  </BaseDialog>
</template>

<script setup lang="ts">
// Une route enfant de la page de jeu, ouverte par-dessus le camp (le Volumen,
// le Grimoire) : son fond, et comment elle se ferme. La page de jeu n'est
// jamais démontée dessous. Voir specs/ecrans.md#volumen et specs/ecrans.md#sorts.
//
// - Fermer, c'est revenir au camp : un détour, pas une étape — croix, Échap,
//   clic à côté.
// - Quelle que soit la sortie, l'animation de fermeture joue avant que la route
//   change. La route attend la fin des animations elles-mêmes, pas une durée
//   recopiée de main.css ; sans animation (mouvement réduit), elle part tout de
//   suite. Les animations en boucle (étincelles) ne comptent pas. Une seule
//   sortie à la fois : toute navigation qui part pendant ce temps attend la
//   même.
// - Le middleware `camp` ne garde que l'entrée : la partie peut quitter le camp
//   pendant la lecture — attente échue, rattrapage tiré dans un autre onglet.
//   La boîte se ferme alors d'elle-même. Un changement fait ailleurs ne se voit
//   qu'en relisant : on relit au retour sur l'onglet.
import { isNavigationFailure, NavigationFailureType } from 'vue-router'
import type { GameStateRead } from '~/composables/useGameState'

const props = defineProps<{
  /** Ce que lit une synthèse vocale en entrant dans la boîte. */
  label: string
  /**
   * L'état de jeu, déjà lu par la page : elle l'attend dans son `<script
   * setup>`, ce qu'un composant ne peut pas faire sans Suspense.
   */
  game: Pick<GameStateRead, 'state' | 'refresh'>
}>()

defineSlots<{
  default: (scope: { closing: boolean, close: () => void }) => unknown
}>()

const dialog = useTemplateRef<{ element: HTMLDialogElement | null }>('dialog')

const closing = ref(false)

// Pendant la sortie, un second geste — ou le retour du navigateur — lance une
// autre navigation : elle attend la même sortie au lieu de la couper.
function close(): void {
  if (!closing.value) {
    void navigateTo('/')
  }
}

watch(props.game.state, (now) => {
  if (!isAtCamp(now)) {
    close()
  }
})

function onVisible(): void {
  if (document.visibilityState === 'visible') {
    void props.game.refresh()
  }
}

onMounted(() => document.addEventListener('visibilitychange', onVisible))
onUnmounted(() => document.removeEventListener('visibilitychange', onVisible))

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
// une boîte invisible, mais modale : toute la page inerte. La boîte se rouvre
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
