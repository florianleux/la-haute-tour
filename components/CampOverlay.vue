<template>
  <!-- Par-dessus le camp, flouté dessous. Clic sur ce fond = fermer ; le
       contenu, posé par l'appelant, arrête les clics qu'il veut garder.
       `overflow-clip` et non `hidden` : une boîte `hidden` se fait défiler par
       le navigateur pour montrer ce qui prend le focus, et décalait tout le
       contenu vers le haut.

       Le fond prend le curseur main quand la souris est sur
       une zone qui ferme : la boîte elle-même, ou un vide que l'appelant
       marque `data-camp-backdrop` (le tour d'une image, où son `@click.self`
       ferme aussi). Dès qu'autre chose sous la souris est survolé — le
       contenu —, le curseur redevient celui du contenu. -->
  <BaseDialog
    ref="dialog"
    :label="label"
    class="items-start justify-center overflow-clip bg-transparent [&:hover:not(:has(:not([data-camp-backdrop]):hover))]:cursor-pointer"
    @close="close"
  >
    <!-- Le voile, seul à se fondre : posé sur la boîte entière, le fondu
         rendait aussi le contenu transparent pendant son entrée, et le camp se
         voyait à travers le parchemin qui montait. Sous le contenu, et
         traversé par les clics : ils tombent sur la boîte, qui ferme. -->
    <div
      class="pointer-events-none absolute inset-0 -z-10 bg-slate-950/40 backdrop-blur-xs"
      :class="closing ? 'motion-safe:animate-fade-out [--enter-delay:0.25s]' : 'motion-safe:animate-fade-in'"
    />

    <slot :closing="closing" :close="close" />

    <!-- La croix, hors du contenu : dans le coin de l'écran, la même pour
         toutes les boîtes. Après le contenu, pour passer devant. -->
    <BaseCloseButton :label="closeLabel" class="absolute right-[2vw] top-[2dvh] z-20" @click="close" />
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
//   rattrapage tiré dans un autre onglet —, ou l'avoir quitté avant même que
//   la boîte soit montée. La boîte se ferme alors d'elle-même. Un changement
//   fait ailleurs ne se voit qu'en relisant : on relit au retour sur l'onglet.
//
// L'état de jeu est celui que la page a déjà lu, pris dans la lecture partagée :
// la boîte n'en demande pas un second.
import { GAME_STATE_KEY } from '~/composables/useGameState'
import type { GameState } from '~~/server/utils/game'

defineProps<{
  /** Ce que lit une synthèse vocale en entrant dans la boîte. */
  label: string
  /** Ce que lit une synthèse vocale sur la croix : « Fermer le Volumen ». */
  closeLabel: string
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

const { data: game } = useNuxtData<GameState>(GAME_STATE_KEY)

watch(game, (now) => {
  if (!isAtCamp(now)) {
    close()
  }
}, { immediate: true })

function onVisible(): void {
  if (document.visibilityState === 'visible') {
    void refreshNuxtData(GAME_STATE_KEY)
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
