<template>
  <!-- L'objet d'une boîte du camp — grimoire, bannière, sac —, posé par-dessus
       le camp (CampOverlay) : son image, ses zones qui gardent le clic, et ce
       que l'appelant y pose (slot). Clic à côté = fermer, y compris dans les
       vides transparents de l'image : seules les zones `hits` l'arrêtent.

       Taille, proportions et pivot viennent de l'appelant, par `class` : chaque
       image a les siens. Les positions en % des zones sont relevées sur
       l'image. -->
  <div
    class="relative shrink-0"
    :class="closing ? leave : enter"
    data-camp-backdrop
    @click.self="$emit('close')"
  >
    <img
      :src="src"
      alt=""
      class="pointer-events-none absolute inset-0 size-full select-none"
    >
    <div v-for="hit in hits" :key="hit" class="absolute" :class="hit" />
    <slot />
  </div>
</template>

<script setup lang="ts">
defineProps<{
  src: string
  closing: boolean
  /** L'animation d'entrée, et celle de sortie, en classes Tailwind complètes. */
  enter: string
  leave: string
  /** Les zones de l'objet qui gardent le clic, en classes de position. */
  hits: string[]
}>()

defineEmits<{ close: [] }>()
</script>
