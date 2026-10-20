<template>
  <!-- Le titre d'une boîte du camp, au-dessus de ce qu'elle montre, dans
       l'éclat des noms du camp. Il jaillit avec le même rebond que le verdict
       juste (animate-cheer), au délai que l'appelant cale sur son ouverture, et
       s'efface d'un coup à la fermeture. L'appelant le place en hauteur, par
       `class` (`top-…`) : son bas se pose sur cette ligne, centré. -->
  <h1
    class="absolute left-1/2 -translate-x-1/2 -translate-y-full origin-bottom pb-[0.2em] text-[max(3rem,8dvh)]"
    :class="closing ? 'motion-safe:animate-fade-out' : 'motion-safe:animate-cheer'"
    :style="{ '--enter-delay': closing ? '0s' : delay }"
  >
    <BaseGlowLabel tone="soft">
      <slot />
    </BaseGlowLabel>
  </h1>
</template>

<script setup lang="ts">
defineProps<{
  closing: boolean
  /** Quand il jaillit après l'ouverture : pendant le déroulé, ou le rebond. */
  delay: string
}>()
</script>
