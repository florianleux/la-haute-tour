<template>
  <!-- La tuile et sa bulle, côte à côte : la bulle n'est pas dans le bouton, qui
       n'accepte que du contenu en ligne. -->
  <div>
    <button
      type="button"
      class="group relative w-full cursor-pointer rounded-lg p-[6%] transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
      :aria-label="label"
      @click="$emit('click')"
      @mouseenter="anchor = $event.currentTarget as HTMLElement"
      @mouseleave="anchor = null"
      @wheel.passive="anchor = null"
    >
      <slot />
    </button>

    <!--
      Dans la couche du dessus (BaseTopLayer) : hors de la grille qui défile
      (elle la couperait au premier rang) et par-dessus la boîte de dialogue qui
      porte les tuiles. La bulle elle-même est celle des sorts, et ce qu'elle
      dit vient de l'appelant (`#tip`). Elle n'existe que là où le survol
      existe — sur un tap elle resterait collée par-dessus la grille, sans rien
      pour la fermer. Le défilement la ferme : la tuile part sous la souris.
    -->
    <BaseTopLayer
      v-if="anchor"
      class="pointer-events-none fixed inset-auto hidden w-72 -translate-x-1/2 -translate-y-full [@media(hover:hover)]:block"
      :style="placeAbove(anchor)"
      role="presentation"
    >
      <BaseTooltip>
        <slot name="tip" />
      </BaseTooltip>
    </BaseTopLayer>
  </div>
</template>

<script setup lang="ts">
// La tuile cliquable d'une grille : son cadre, son focus, et la bulle qui dit ce
// qu'elle est. Ce qu'elle montre vient du slot — elle ne connaît ni image ni
// domaine.
defineProps<{
  /** Ce qu'une synthèse vocale lit de la tuile. */
  label: string
}>()

defineEmits<{ click: [] }>()

/** La tuile survolée ; null quand rien ne l'est. */
const anchor = ref<HTMLElement | null>(null)

// Au-dessus de la tuile, centrée sur elle, à 8 px. Lu au survol : la tuile ne
// bouge pas tant que la souris est dessus.
function placeAbove(tile: HTMLElement): Record<string, string> {
  const rect = tile.getBoundingClientRect()

  return { left: `${rect.left + rect.width / 2}px`, top: `${rect.top - 8}px` }
}
</script>
