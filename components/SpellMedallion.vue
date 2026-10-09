<template>
  <!-- Un sort sans médaillon dessiné retombe sur l'étincelle. La taille et
       l'ombre viennent de l'appelant ; `fallbackClass` ne teint que l'étincelle,
       un fond posé sur l'image se verrait dans ses coins transparents. -->
  <img
    v-if="image"
    :src="image"
    :alt="alt"
    class="aspect-square object-contain"
  >
  <span
    v-else
    class="flex aspect-square items-center justify-center rounded-full"
    :class="fallbackClass"
    :role="alt ? 'img' : undefined"
    :aria-label="alt || undefined"
    :aria-hidden="alt ? undefined : 'true'"
  >✦</span>
</template>

<script setup lang="ts">
// Le médaillon d'un effet, face comprise : un seul endroit décide entre le
// dessin et l'étincelle. Voir utils/spells.ts#spellImage.
import type { SpellFace, SpellId } from '~~/shared/utils/spells'

const props = withDefaults(defineProps<{
  spell: SpellId
  face: SpellFace
  /** Vide quand le texte voisin nomme déjà le sort. */
  alt?: string
  fallbackClass?: string
}>(), { alt: '', fallbackClass: '' })

const image = computed(() => spellImage(props.spell, props.face))
</script>
