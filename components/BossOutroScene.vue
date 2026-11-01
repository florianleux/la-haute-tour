<template>
  <!-- Posée par-dessus l'arène (z-30, au-dessus des barres de vie), qui
       s'efface dessous dans un fondu lent vers le fond (`backdrop`). Puis, temps
       après temps (`step`) : le boss paraît en fondu, sur place, comme à
       l'introduction, pendant que son titre se révèle lentement au-dessus de
       lui ; enfin sa fenêtre monte. Sous un écran par-dessus (`veiled`), le
       fond seul reste : la scène se lirait à travers son voile. -->
  <div class="fixed inset-0 z-30 overflow-hidden @container-size">
    <div
      class="absolute inset-0 motion-safe:transition-opacity motion-safe:duration-[2500ms] motion-safe:ease-in"
      :class="[backdrop, reached('backdrop') ? 'opacity-100' : 'opacity-0']"
    />

    <div
      v-if="!veiled"
      :class="[BACKDROP_BOX, BACKDROP_COVER]"
    >
      <div
        class="@container"
        :class="BACKDROP_SCENE"
      >
        <BossFigure
          :figure="boss.figure"
          :pose="pose"
          :expression="expression"
          :talking="false"
          class="absolute motion-safe:transition-opacity motion-safe:duration-[3000ms] motion-safe:ease-out"
          :class="[figureBox ?? FALLBACK_BOX, reached('title') ? 'opacity-100' : 'opacity-0']"
        />

        <!-- Le titre, s'il y en a un : il monte du fond pendant que sa propre
             révélation (TITLE_GOLD, TITLE_RED) le dessine. -->
        <Transition
          enter-active-class="motion-safe:transition-opacity motion-safe:duration-[3000ms] motion-safe:ease-out"
          enter-from-class="opacity-0"
        >
          <div
            v-if="$slots.title && reached('title')"
            class="absolute inset-x-0 top-[6%] flex flex-col items-center"
          >
            <slot name="title" />
          </div>
        </Transition>

        <!-- Sa fenêtre, entrée comme celles de l'introduction. Sans geste, un
             clic sur elle enchaîne, comme une réplique de l'introduction. -->
        <Transition
          enter-active-class="motion-safe:transition-[opacity,translate] motion-safe:duration-500 motion-safe:ease-out"
          enter-from-class="translate-y-[1.5cqw] opacity-0"
        >
          <BaseDialogueWindow
            v-if="reached('window')"
            :remark="remark"
            :colors="colors"
            :gestures="gestures"
            class="absolute bottom-[5%] left-1/2 w-[51%] -translate-x-1/2"
            :class="!gestures && 'cursor-pointer'"
            @click="!gestures && emit('advance')"
          />
        </Transition>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// La mise en scène commune des outros de boss (specs/spec.md#glossaire) : celle
// de victoire (BossVictory) et celle de défaite (BossOutro) déroulent les mêmes
// temps, chacune avec son fond, sa pose, son titre et sa réplique.
import { BACKDROP_BOX, BACKDROP_COVER, BACKDROP_SCENE } from '~~/utils/backdrop'
import type { BossEntry, BossExpression, BossPose } from '~~/utils/bosses'
import type { DialogueAction } from '~~/utils/dialogue'
import { prefersReducedMotion } from '~~/utils/motion'

const props = defineProps<{
  boss: BossEntry
  pose: BossPose
  expression: BossExpression
  /** Ce qu'il dit, dans sa fenêtre. */
  remark: string
  /** Le fond vers lequel l'arène s'efface, en classes complètes. */
  backdrop: string
  /** Les couleurs de sa fenêtre, celles de son introduction ; absentes, celles du joueur. */
  colors?: string
  /** Sa place à l'introduction (`figureBox` de bossIntros) ; absente, centré au milieu. */
  figureBox?: string
  /** Les gestes de sa fenêtre ; sans, un clic sur elle enchaîne (`advance`). */
  gestures?: readonly [DialogueAction, ...DialogueAction[]]
  /** Le verdict encore lu, avant que le fond ne monte. */
  holdMs?: number
  /** Le titre révélé : la fenêtre vient ensuite. */
  titleMs?: number
  /** Entrée enchaîne aussi, une fois la fenêtre montée. */
  advanceOnEnter?: boolean
  /** Un écran par-dessus (la relique) : le fond seul reste. */
  veiled?: boolean
}>()

const emit = defineEmits<{ advance: [] }>()

const FALLBACK_BOX = 'left-1/2 top-[22%] w-[42%] -translate-x-1/2'
/** Le fond monté (`duration-[2500ms]`), un rien de marge : le boss paraît ensuite. */
const BACKDROP_MS = 2600

type Step = 'arena' | 'backdrop' | 'title' | 'window'
const ORDER: Step[] = ['arena', 'backdrop', 'title', 'window']
const step = ref<Step>('arena')

function reached(target: Step): boolean {
  return ORDER.indexOf(step.value) >= ORDER.indexOf(target)
}

const timers: ReturnType<typeof setTimeout>[] = []

onMounted(() => {
  // Sans animation, tout est là d'emblée : rien à attendre.
  if (prefersReducedMotion()) {
    step.value = 'window'
    return
  }
  const hold = props.holdMs ?? 0
  const title = hold + BACKDROP_MS
  const at: [Step, number][] = [['backdrop', hold], ['title', title], ['window', title + (props.titleMs ?? 3500)]]
  // Deux images : l'arène doit être peinte sous le fond transparent avant
  // qu'il ne monte, sinon il serait là d'un coup.
  requestAnimationFrame(() => requestAnimationFrame(() => {
    for (const [next, atMs] of at) {
      timers.push(setTimeout(() => {
        step.value = next
      }, atMs))
    }
  }))
})

onBeforeUnmount(() => timers.forEach(clearTimeout))

useAdvanceOnEnter(() => emit('advance'), () => !!props.advanceOnEnter && reached('window') && !props.veiled)
</script>
