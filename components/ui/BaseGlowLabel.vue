<template>
  <!-- Un nom blanc et lumineux, ses étincelles au-dessus. L'ombre sombre au
       plus près détache le blanc d'un décor clair ; le halo bleuté, plus
       large, garde l'éclat. -->
  <span
    class="inline-block whitespace-nowrap text-center font-semibold tracking-wide text-white"
    :class="soft
      ? '[text-shadow:0_1px_2px_rgb(0_0_0/0.4),0_0_12px_var(--glow,rgb(191_219_254/0.6))]'
      : '[text-shadow:0_1px_2px_rgb(0_0_0/0.85),0_0_6px_rgb(0_0_0/0.6),0_0_14px_var(--glow,rgb(191_219_254/0.7))]'"
    :style="color ? { color, '--glow': color } : undefined"
  >
    <!-- Une boîte à soi, positionnée, pour les étincelles : la racine reste
         libre de se placer comme l'appelant le veut (`absolute` au camp). -->
    <span class="relative block">
      <slot />
      <SparkleField
        :sparks="SPARKS"
        class="drop-shadow-[0_0_3px_#fff]"
      />
    </span>
  </span>
</template>

<script setup lang="ts">
// Le nom des objets du camp au survol (CooldownCamp), le titre du Volumen
// posé au-dessus de son papier, et celui d'un sort lancé au Grimoire : même
// éclat partout. La position et
// la taille viennent de l'appelant, par `class`.

defineProps<{
  /**
   * Ombre allégée, pour un grand titre sur un fond déjà sombre ou flouté : à
   * cette taille, l'ombre des noms du camp l'alourdit.
   */
  soft?: boolean
  /** La couleur du nom et de son halo, au lieu du blanc bleuté : le titre d'un lancer prend celle de sa magie. */
  color?: string
}>()

/**
 * Les étincelles, en % de la boîte du nom : surtout au-dessus du mot, quelques
 * unes débordant sur ses côtés.
 */
const SPARKS = [
  { left: '-8%', top: '-30%', size: '11%', delay: '0s' },
  { left: '30%', top: '-55%', size: '8%', delay: '0.7s' },
  { left: '62%', top: '-40%', size: '10%', delay: '0.3s' },
  { left: '96%', top: '-25%', size: '9%', delay: '1.1s' },
  { left: '104%', top: '55%', size: '6%', delay: '0.5s' },
]
</script>
