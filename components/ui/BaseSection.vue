<script setup lang="ts">
defineProps<{ title: string }>()

defineSlots<{
  /** Phrase d'introduction sous le titre. */
  lead?: () => unknown
  /** Actions alignées sur le titre (un tri, un bouton). */
  aside?: () => unknown
  default?: () => unknown
}>()
</script>

<template>
  <!-- Un bloc d'écran : son titre, sa phrase, son contenu. Écrit une fois pour
       que deux sections ne se mettent pas à diverger de style. -->
  <section>
    <div class="flex items-baseline justify-between gap-4">
      <h2 class="text-lg font-semibold">
        {{ title }}
      </h2>
      <slot name="aside" />
    </div>
    <BaseHint v-if="$slots.lead" class="mt-1">
      <slot name="lead" />
    </BaseHint>
    <slot />
  </section>
</template>
