<template>
  <div class="fixed inset-0 z-1 overflow-hidden bg-[#070d24] @container-size">
    <!-- L'illustration couvre l'écran sans se déformer (BACKDROP_COVER) :
         elle déborde sur les côtés, du décor qu'on peut perdre. Tout ce qui
         s'y pose se place en % de la scène 16:9 au centre, et se mesure en
         cqw : rien ne bouge par rapport au dessin, à toute taille d'écran.
         « Entrer » y plonge : tout le décor grossit lentement autour du cœur
         de l'arche jusqu'à ne plus montrer que son fond uni. Une seule
         transform, la moins chère des animations. Sa durée et son délai
         font ENTER_MS. -->
    <div
      class="motion-safe:transition-transform motion-safe:delay-[500ms] motion-safe:duration-[4000ms] motion-safe:ease-in"
      :class="[BACKDROP_BOX, BACKDROP_COVER, door.archColor, door.archCenter, entering && 'scale-[7]']"
    >
      <img
        :src="door.image"
        :alt="door.name"
        class="absolute inset-0 size-full"
      >
      <div
        class="@container"
        :class="BACKDROP_SCENE"
      >
        <!-- Les battants couvrent l'arche vide du décor et pivotent vers le
             joueur, chacun sur son bord extérieur. Ils s'effacent avant la fin
             du mouvement, sans jamais approcher 90°. Le verso n'est pas le
             recto : la silhouette du battant, en bois sombre.
             Chaque battant porte sa serrure : la clé posée y paraît, et
             « Ouvrir » la tourne d'un quart de tour (la gauche vers la gauche,
             la droite vers la droite) avant que les battants ne s'écartent.
             Les noms des poseurs (ADR 0008) ne s'affichent pas
             encore : choix de Flo.
             Le fondu est sur chaque face (LEAF_FADE), pas sur le battant : une
             opacité sous 1 aplatirait sa 3D, et le recto reparaîtrait au dos. -->
        <div
          class="absolute flex perspective-[40cqw]"
          :class="door.doorway"
        >
          <div
            v-for="leaf in leaves"
            :key="leaf.image"
            class="relative h-full w-1/2 transform-3d motion-safe:[transition:transform_3200ms_ease-in-out_700ms]"
            :class="leaf.swing[opened ? 'open' : 'closed']"
          >
            <img
              :src="leaf.image"
              alt=""
              class="size-full backface-hidden"
              :class="[LEAF_FADE, opened && 'opacity-0']"
            >
            <div
              class="absolute inset-0 rotate-y-180 backface-hidden mask-size-[100%_100%]"
              :class="[door.leafBackColor, LEAF_FADE, opened && 'opacity-0']"
              :style="{ maskImage: `url(${leaf.image})` }"
            />
            <!-- La clé paraît quand on la pose ; « Ouvrir » la tourne, puis
                 elle s'efface avec son battant. -->
            <img
              :src="door.key"
              alt=""
              class="absolute -translate-x-1/2 -translate-y-1/2 backface-hidden"
              :class="[
                leaf.keyhole,
                opened ? ['motion-safe:[transition:rotate_600ms,opacity_500ms_ease-in_2600ms]', leaf.swing.turn, 'opacity-0'] : 'motion-safe:transition-opacity motion-safe:duration-[600ms]',
                leaf.index >= keysPlaced && 'opacity-0',
              ]"
            >
          </div>
        </div>

        <!-- Une ombre sombre de plus sous celles du ton `soft`, par
             `--under-shadow` (voir BaseGlowLabel). Elle n'ombre que le nom :
             ses étincelles gardent leur seul halo. -->
        <BaseGlowLabel
          tone="soft"
          class="absolute left-1/2 top-[3%] -translate-x-1/2 text-[4.6cqw] [--under-shadow:0_0.25cqw_0.6cqw_rgb(0_0_0/0.85)]"
        >
          {{ door.name }}
        </BaseGlowLabel>

        <!-- Une fenêtre de dialogue : le joueur qui pense tout haut. Sa
             remarque dit où en est la porte, les gestes possibles suivent,
             comme les choix d'une réplique (BaseDialogueWindow).

             Une fenêtre par étape (`stage`) : la suivante paraît en fondu
             pendant que la précédente s'efface, à la même place. Pas de
             `mode="out-in"` : la porte se redessinant pendant la sortie (clé
             posée, battants), Vue ne montait jamais la fenêtre suivante — même
             piège que l'introduction du boss. Celle de « Entrer » attend les
             battants, et ne paraît qu'une fois qu'ils ont disparu ; elle ne se
             clique qu'une fois là. Une fenêtre qui s'efface ne se clique plus :
             pas de deuxième geste pendant son fondu. Devant une porte déjà
             ouverte, elle est là d'emblée : pas d'`appear`. -->
        <Transition
          :enter-active-class="stage === 'opened' ? FADE_AFTER_LEAVES : FADE"
          enter-from-class="opacity-0"
          :leave-active-class="FADE"
          leave-to-class="opacity-0"
        >
          <BaseDialogueWindow
            v-if="dialog"
            :key="stage"
            :remark="dialog.remark"
            :gestures="dialog.gestures"
            class="absolute bottom-[5%] left-1/2 w-[51%] -translate-x-1/2"
          />
        </Transition>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// L'écran de porte du boss (specs/boss.md#porte-à-deux-clés), le même pour
// toutes les portes : seule l'entrée de BOSS_DOORS change d'un étage à l'autre.
// Il n'affiche que ce qu'on lui donne ; la règle (qui peut poser, quand la
// porte s'ouvre) reste au serveur. Banc : pages/test/door/[floor].vue.
import { BACKDROP_BOX, BACKDROP_COVER, BACKDROP_SCENE } from '~~/utils/backdrop'
import type { BossDoorEntry } from '~~/utils/bossDoors'
import type { DialogueAction } from '~~/utils/dialogue'
import { prefersReducedMotion, wait } from '~~/utils/motion'

const props = defineProps<{
  door: BossDoorEntry
  /** Combien de clés l'équipe a posées : 0 à 2, une serrure allumée par clé. */
  keysPlaced: number
  /** Le joueur a une clé à poser. */
  hasKey: boolean
  /** Porte déverrouillée : deux clés posées, ou joueur sans équipe. */
  unlocked: boolean
  /** Porte ouverte : le joueur a cliqué « Ouvrir », ses battants sont écartés. */
  opened: boolean
}>()

const emit = defineEmits<{ placeKey: [], openDoor: [], enter: [], descendToCamp: [] }>()

/**
 * Le fondu d'une fenêtre de dialogue de la porte, en sortie comme en entrée.
 * Elle ne se clique pas pendant ce temps : un deuxième clic sur une fenêtre qui
 * s'efface relancerait son geste.
 */
const FADE = 'pointer-events-none motion-safe:transition-opacity motion-safe:duration-[800ms]'
/**
 * La fenêtre de « Entrer », qui attend les battants : son délai la fait
 * paraître une fois les battants effacés (3,1 s après le clic : 700 + 2600 +
 * 500 ms de leur transition), de 3,1 s à 3,9 s.
 */
const FADE_AFTER_LEAVES = `${FADE} motion-safe:delay-[3100ms]`

/** Le fondu des deux faces d'un battant ouvert, à la fin de son pivot. */
const LEAF_FADE = 'motion-safe:[transition:opacity_500ms_ease-in_2600ms]'

/**
 * Chaque battant pivote sur son bord extérieur, son bord intérieur vient vers
 * le joueur ; sa clé tourne d'abord vers ce même bord. Le pivot attend ce
 * quart de tour (600 ms, plus un temps) : `_700ms` sur la transition des
 * battants, et 700 ms de plus sur leur fondu et sur l'arrivée de « Entrer ».
 */
const LEAF_SWING = {
  left: { closed: 'origin-left', open: 'origin-left -rotate-y-[80deg]', turn: '-rotate-90' },
  right: { closed: 'origin-right', open: 'origin-right rotate-y-[80deg]', turn: 'rotate-90' },
} as const

const leaves = computed(() => [
  { index: 0, image: props.door.leaves[0], keyhole: props.door.keyholes[0], swing: LEAF_SWING.left },
  { index: 1, image: props.door.leaves[1], keyhole: props.door.keyholes[1], swing: LEAF_SWING.right },
])

/** La plongée dans l'arche, délai compris : `delay-[500ms]` + `duration-[4000ms]` du décor. */
const ENTER_MS = 4500

/** Le joueur a cliqué « Entrer » : le décor plonge dans l'arche, puis `enter` part. */
const entering = ref(false)

/**
 * Un minuteur plutôt que `transitionend`, comme le coffre et les sorts : sous
 * « réduire les animations », `motion-safe:` retire la transition et
 * l'événement ne viendrait jamais.
 */
async function enter(): Promise<void> {
  entering.value = true
  await wait(prefersReducedMotion() ? 0 : ENTER_MS)
  if (!unmounted) {
    emit('enter')
  }
}

/** L'écran quitté pendant la plongée : son `enter` ne part plus. */
let unmounted = false
onBeforeUnmount(() => {
  unmounted = true
})

/** Où en est la porte pour ce joueur : une fenêtre de dialogue par étape, aucune une fois qu'il entre. */
const stage = computed(() => {
  if (entering.value) {
    return 'entering'
  }
  if (props.opened) {
    return 'opened'
  }
  return props.unlocked ? 'unlocked' : 'locked'
})

/**
 * Ce que le joueur se dit devant la porte, et ce qu'il peut y faire. Qui a posé
 * la clé déjà en place, l'écran ne le sait pas (ADR 0008, pas encore affiché) :
 * la remarque n'en parle pas. Sans équipe, la porte est déverrouillée sans clé.
 */
/** Une fenêtre de dialogue de la porte : la remarque, puis les gestes. */
interface DoorDialog {
  remark: string
  gestures: readonly [DialogueAction, ...DialogueAction[]]
}

const dialog = computed((): DoorDialog | null => {
  if (stage.value === 'entering') {
    return null
  }
  if (stage.value === 'opened') {
    return {
      remark: 'La porte est ouverte. Je ne sais pas ce qui m\'attend là-dedans…',
      gestures: [{ label: 'Entrer', run: enter }],
    }
  }
  if (stage.value === 'unlocked') {
    return {
      remark: props.keysPlaced >= props.door.keyholes.length
        ? 'Les deux clés sont dans leurs serrures. Plus rien ne retient cette porte.'
        : 'Aucune serrure ne retient cette porte. Elle n\'attend que moi.',
      gestures: [{ label: 'Ouvrir', run: () => emit('openDoor') }],
    }
  }
  // « Redescendre au camp » toujours en dernier, la clé avant s'il en a une.
  const descend: DialogueAction = { label: 'Redescendre au camp', run: () => emit('descendToCamp') }
  return {
    remark: lockedRemark(),
    gestures: props.hasKey
      ? [{ label: `Utiliser ${props.door.keyName}`, run: () => emit('placeKey') }, descend]
      : [descend],
  }
})

/** Devant la porte verrouillée : combien de clés manquent, et s'il peut en poser une. */
function lockedRemark(): string {
  if (props.keysPlaced === 0) {
    return props.hasKey
      ? 'Mmmh, il semble qu\'il faille DEUX clés pour ouvrir cette porte. Je peux poser la mienne, mais je devrai attendre quelqu\'un de ma guilde.'
      : 'Mmmh, il semble qu\'il faille DEUX clés pour ouvrir cette porte, et je n\'en ai aucune. Je devrais attendre quelqu\'un de ma guilde.'
  }
  return props.hasKey
    ? 'Une clé est déjà dans sa serrure. Avec la mienne, cette porte devrait céder.'
    : 'Une clé est dans sa serrure, il en manque une deuxième. Je devrais attendre quelqu\'un de ma guilde.'
}
</script>
