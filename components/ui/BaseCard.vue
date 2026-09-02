<script setup lang="ts">
defineProps<{ title?: string }>()

defineSlots<{
  /** Introductory line under the title. */
  lead?: () => unknown
  default?: () => unknown
}>()
</script>

<template>
  <div class="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/60 p-8 shadow-xl">
    <h1 v-if="title" class="text-2xl font-bold">
      {{ title }}
    </h1>
    <p v-if="$slots.lead" class="mt-2 text-sm text-slate-400">
      <slot name="lead" />
    </p>
    <slot />
  </div>
</template>
