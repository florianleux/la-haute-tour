<template>
  <!-- Un sort sans médaillon dessiné retombe sur l'étincelle. La taille et la
       place viennent de l'appelant, l'ombre aussi, par `shadowClass` ;
       `fallbackClass` ne teint que l'étincelle, un fond posé sur l'image se
       verrait dans ses coins transparents. La racine n'est pas positionnée :
       un `relative` ici l'emporterait sur l'`absolute` d'un appelant
       (SpellbookDetails). C'est la boîte intérieure qui tient le disque
       d'ombre. -->
  <span class="inline-block aspect-square">
    <span class="relative block size-full">
      <span
        v-if="shadowClass"
        class="absolute inset-[4%] rounded-full"
        :class="shadowClass"
      />
      <img
        v-if="image"
        :src="image"
        :alt="alt"
        class="relative block size-full object-contain"
      >
      <span
        v-else
        class="relative flex size-full items-center justify-center rounded-full"
        :class="fallbackClass"
        :role="alt ? 'img' : undefined"
        :aria-label="alt || undefined"
        :aria-hidden="alt ? undefined : 'true'"
      >✦</span>
    </span>
  </span>
</template>

<script setup lang="ts">
// Le médaillon d'un effet, face comprise : un seul endroit décide entre le
// dessin et l'étincelle. Voir utils/spells.ts#spellImage.
//
// L'ombre est une `box-shadow` sur un disque sous l'image, pas un
// `drop-shadow` sur elle : le médaillon est rond et remplit son image, et le
// filtre, sur un médaillon qui grossit, Safari le peint sur tout le carré de
// l'image. Voir CLAUDE.md#styling. Le disque est un peu plus petit que le
// dessin : une `box-shadow` n'est pas peinte sous sa boîte, et un disque à
// ras laissait un liseré sans ombre entre son bord et celui, irrégulier, du
// médaillon. Sur l'étincelle de repli, le disque ombre son cercle, pas le
// glyphe ✦ : sans fond, celui-ci n'a plus d'ombre à lui.
import type { SpellId } from '~~/shared/utils/spells'
import type { SpellImageVariant } from '~~/utils/spells'

const props = withDefaults(defineProps<{
  spell: SpellId
  /** `mixed` pour un sort qui n'a pas encore de face : en poche, pas posé. */
  face: SpellImageVariant
  /** Vide quand le texte voisin nomme déjà le sort. */
  alt?: string
  fallbackClass?: string
  /** Les classes du disque d'ombre : une `shadow-[…]` Tailwind (les valeurs
   *  d'un `drop-shadow`, inchangées), et sa transition au besoin. */
  shadowClass?: string
}>(), { alt: '', fallbackClass: '', shadowClass: '' })

const image = computed(() => spellImage(props.spell, props.face))
</script>
