<template>
  <!-- La figure du boss : le corps de sa pose, la tête de son expression
       par-dessus, chacun à sa place relevée sur le cadre de la figure. Sans
       position propre : l'écran qui la pose la place (absolute, fixed). -->
  <div :class="figure.frame">
    <img
      :src="body.src"
      alt=""
      class="absolute max-w-none"
      :class="body.box"
    >
    <!-- Au cri, la tête part en plus sur sa propre secousse ; quand il parle
         ou réagit, elle hoche. Toujours autour du cou, juste au-dessus du
         menton (51 % × 88 % de la tête, mêmes pour les quatre : cadrage
         commun), jamais autour d'un coin de l'image. -->
    <img
      :src="figure.heads[expression]"
      alt=""
      class="absolute max-w-none origin-[51%_88%]"
      :class="[figure.headBox, shaking ? 'motion-safe:animate-shout-head' : talking && 'motion-safe:animate-head-talk']"
    >
  </div>
</template>

<script setup lang="ts">
// La figure d'un boss en pièces (specs/spec.md, glossaire, « Figure du
// boss ») : un corps par pose, une tête par expression, combinés ici. Lue
// par l'introduction (components/BossIntro.vue) et le combat.
import type { BossExpression, BossFigure, BossPose } from '~~/utils/bossIntros'

const props = defineProps<{
  figure: BossFigure
  pose: BossPose
  expression: BossExpression
  /** Le cri : la tête tremble à son rythme, en plus de ce qui secoue la figure entière. */
  shaking?: boolean
  /** Il parle ou réagit : la tête hoche. Le cri passe devant. */
  talking?: boolean
}>()

const body = computed(() => props.figure.bodies[props.pose])
</script>
