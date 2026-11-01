<template>
  <!-- Posée par-dessus l'arène, qui s'efface dessous dans un fondu lent au
       noir. Puis, temps après temps (`step`) : le boss paraît en fondu, sur
       place, comme à l'introduction ; « DÉFAITE » se révèle lentement
       au-dessus de lui ; enfin sa fenêtre monte, avec « Redescendre ». -->
  <div class="fixed inset-0 z-30 overflow-hidden @container-size">
    <div
      class="absolute inset-0 bg-black motion-safe:transition-opacity motion-safe:duration-[2500ms] motion-safe:ease-in"
      :class="reached('black') ? 'opacity-100' : 'opacity-0'"
    />

    <div :class="[BACKDROP_BOX, BACKDROP_COVER]">
      <div
        class="@container"
        :class="BACKDROP_SCENE"
      >
        <!-- Le boss, à la place de son introduction, bras écartés, qui rit
             du joueur tombé. Il paraît en fondu, sans bouger. -->
        <BossFigure
          :figure="boss.figure"
          pose="open"
          expression="laugh"
          :talking="false"
          class="absolute motion-safe:transition-opacity motion-safe:duration-[1500ms]"
          :class="[figureBox ?? FALLBACK_BOX, reached('figure') ? 'opacity-100' : 'opacity-0']"
        />

        <!-- « DÉFAITE », en grand titre comme le nom du boss à l'introduction,
             mais rouge, et qui reste : il monte du noir, et sa révélation de
             gauche à droite prend son temps (`--title-ms`). -->
        <Transition
          enter-active-class="motion-safe:transition-opacity motion-safe:duration-[3000ms] motion-safe:ease-out"
          enter-from-class="opacity-0"
        >
          <p
            v-if="reached('title')"
            class="absolute inset-x-0 top-[6%] text-center text-[5.5cqw] [--title-ms:4500ms]"
            :class="TITLE_RED"
          >
            Défaite
          </p>
        </Transition>

        <!-- Sa fenêtre, entrée comme celles de l'introduction. -->
        <Transition
          enter-active-class="motion-safe:transition-[opacity,translate] motion-safe:duration-500 motion-safe:ease-out"
          enter-from-class="translate-y-[1.5cqw] opacity-0"
        >
          <BaseDialogueWindow
            v-if="reached('window')"
            :remark="boss.defeatLine"
            :colors="colors"
            :gestures="[{ label: 'Redescendre', run: () => emit('leave') }]"
            class="absolute bottom-[5%] left-1/2 w-[51%] -translate-x-1/2"
          />
        </Transition>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// L'outro de défaite (specs/spec.md#glossaire, Outro de défaite) : la dernière
// vie perdue contre le boss, avant le camp en attente. Rien ne s'y joue côté
// serveur — l'attente a déjà commencé ; « Redescendre » ne fait que quitter
// l'écran, comme après une chute.
import { BACKDROP_BOX, BACKDROP_COVER, BACKDROP_SCENE } from '~~/utils/backdrop'
import { TITLE_RED } from '~~/utils/typography'
import type { BossEntry } from '~~/utils/bosses'
import { prefersReducedMotion } from '~~/utils/motion'

defineProps<{
  boss: BossEntry
  /** Les couleurs de sa fenêtre, celles de son introduction ; absentes, celles du joueur. */
  colors?: string
  /** Sa place à l'introduction (`figureBox` de bossIntros) ; absente, centré au milieu. */
  figureBox?: string
}>()

const emit = defineEmits<{ leave: [] }>()

const FALLBACK_BOX = 'left-1/2 top-[22%] w-[42%] -translate-x-1/2'

/**
 * Les temps de l'outro, dans l'ordre, et quand chacun commence : le noir dès
 * l'image suivante (sa transition part de l'arène visible), le boss une fois
 * le noir fait, son titre quand il est là, sa fenêtre quand le titre s'est
 * révélé.
 */
const STEPS = [
  { step: 'black', atMs: 0 },
  { step: 'figure', atMs: 2600 },
  { step: 'title', atMs: 4300 },
  { step: 'window', atMs: 7800 },
] as const

type Step = typeof STEPS[number]['step'] | 'arena'

const step = ref<Step>('arena')
const order: Step[] = ['arena', ...STEPS.map(entry => entry.step)]

function reached(target: Step): boolean {
  return order.indexOf(step.value) >= order.indexOf(target)
}

const timers: ReturnType<typeof setTimeout>[] = []

onMounted(() => {
  // Sans animation, tout est là d'emblée : rien à attendre.
  if (prefersReducedMotion()) {
    step.value = 'window'
    return
  }
  // Deux images : l'arène doit être peinte sous le voile transparent avant
  // que le noir ne monte, sinon il serait là d'un coup.
  requestAnimationFrame(() => requestAnimationFrame(() => {
    for (const { step: next, atMs } of STEPS) {
      timers.push(setTimeout(() => {
        step.value = next
      }, atMs))
    }
  }))
})

onBeforeUnmount(() => timers.forEach(clearTimeout))
</script>
