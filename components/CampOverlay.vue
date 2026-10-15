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
// Une boîte ouverte par-dessus le camp (le Volumen, le Grimoire, les Haut-faits,
// l'Inventaire) : son fond, et comment elle se ferme. Elle n'a pas d'URL : la
// page de jeu la monte quand un objet du camp est cliqué et la démonte quand
// elle prévient (`close`) — elle-même n'est jamais démontée dessous.
// Voir specs/ecrans.md#volumen et specs/ecrans.md#sorts.
//
// - Fermer, c'est revenir au camp : un détour, pas une étape — croix, Échap,
//   clic à côté.
// - L'animation de fermeture joue avant que la boîte prévienne la page. Elle
//   attend la fin des animations elles-mêmes, pas une durée recopiée de
//   main.css ; sans animation (mouvement réduit), elle prévient tout de suite.
//   Les animations en boucle (étincelles) ne comptent pas. Une seule sortie à
//   la fois : un second geste pendant ce temps ne relance rien.
// - La partie peut quitter le camp pendant la lecture — attente échue,
//   rattrapage tiré dans un autre onglet. La boîte se ferme alors d'elle-même.
//   Un changement fait ailleurs ne se voit qu'en relisant : on relit au retour
//   sur l'onglet.
import type { GameStateRead } from '~/composables/useGameState'

const props = defineProps<{
  /** Ce que lit une synthèse vocale en entrant dans la boîte. */
  label: string
  /**
   * L'état de jeu, déjà lu par l'appelant : il l'attend dans son `<script
   * setup>`, ce que ce composant ne fait pas.
   */
  game: Pick<GameStateRead, 'state' | 'refresh'>
}>()

const emit = defineEmits<{ close: [] }>()

defineSlots<{
  default: (scope: { closing: boolean, close: () => void }) => unknown
}>()

const dialog = useTemplateRef<{ element: HTMLDialogElement | null }>('dialog')

const closing = ref(false)

function close(): void {
  if (!closing.value) {
    void playExit()
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

async function playExit(): Promise<void> {
  closing.value = true
  await nextTick()

  const exits = (dialog.value?.element?.getAnimations({ subtree: true }) ?? [])
    .filter(animation => animation.effect?.getTiming().iterations !== Infinity)

  // allSettled : une animation remplacée en route rejette sa promesse. Le
  // plafond : dans un onglet masqué, le navigateur ne fait pas avancer les
  // animations — une fermeture lancée par la partie (attente échue) y
  // laisserait la boîte jusqu'au retour du joueur.
  await Promise.race([
    Promise.allSettled(exits.map(animation => animation.finished)),
    new Promise(resolve => setTimeout(resolve, EXIT_CEILING_MS)),
  ])

  emit('close')
}
</script>
