<script setup lang="ts">
defineProps<{
  title?: string
  /** Pour un contenu qui ne tient pas en colonne étroite (une liste, un tableau). */
  wide?: boolean
}>()

defineSlots<{
  /** Introductory line under the title. */
  lead?: () => unknown
  default?: () => unknown
}>()
</script>

<template>
  <div
    class="w-full rounded-2xl border border-slate-800 bg-slate-900/60 p-8 shadow-xl"
    :class="wide ? 'max-w-3xl' : 'max-w-md'"
  >
    <h1 v-if="title" class="text-2xl font-bold">
      {{ title }}
    </h1>
    <p v-if="$slots.lead" class="mt-2 text-sm text-slate-400">
      <slot name="lead" />
    </p>
    <slot />
  </div>
</template>
