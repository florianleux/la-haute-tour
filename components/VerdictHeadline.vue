<template>
  <!-- Le juste jaillit, juste après le tampon du médaillon, et lâche une
       gerbe d'étincelles à son plus gros. Le faux, lui, secoue la tête. La
       couleur arrive par `class`, avec le texte. -->
  <PlayText
    role="headline"
    :large="large"
    :class="[cheer ? 'relative motion-safe:animate-cheer' : 'motion-safe:animate-shake', '[--enter-delay:0.1s]']"
  >
    <slot />
    <SparkleSpray
      v-if="cheer"
      :sparks="CHEER_SPRAY"
      glow="#6ee7b7"
    />
  </PlayText>
</template>

<script setup lang="ts">
// Le titre d'un verdict, écrit une fois : celui d'une question (VerdictLines)
// et celui d'une épreuve du boss (BossFlagTrial) jaillissent ou secouent pareil.
defineProps<{
  /** Une bonne nouvelle : il jaillit, sinon il secoue la tête. */
  cheer: boolean
  /** Agrandi d'un cinquième (PlayText). */
  large?: boolean
}>()

/**
 * La gerbe du « Correct ! » : huit étincelles sur une ellipse plus large que
 * haute, comme le mot. Lancées quand il atteint son plus gros (30 % de
 * `animate-cheer`, plus son délai), une sur deux plus loin et plus grosse pour
 * casser la régularité — même recette que la gerbe du coffre (ChestCard).
 * Distances en cqw du panneau, qui est un @container (voir PlayFrame).
 */
const CHEER_SPRAY = Array.from({ length: 8 }, (_, index) => {
  const angle = ((index * 45 + 20) * Math.PI) / 180
  const reach = index % 2 ? 0.8 : 1

  return {
    dx: `${Math.round(Math.cos(angle) * 34 * reach)}cqw`,
    dy: `${Math.round(Math.sin(angle) * 9 * reach)}cqw`,
    size: index % 2 ? '2.4cqw' : '3.6cqw',
    delay: `${(0.28 + (index % 3) * 0.04).toFixed(2)}s`,
  }
})
</script>
