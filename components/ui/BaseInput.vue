<script setup lang="ts">
defineProps<{
  label: string
  placeholder?: string
}>()

const model = defineModel<string>({ required: true })
</script>

<template>
  <label class="block">
    <span class="text-xs font-medium uppercase tracking-wide text-slate-500">
      {{ label }}
    </span>
    <input
      v-model="model"
      type="text"
      :placeholder="placeholder"
      class="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:border-indigo-400 focus:outline-none"
    >
  </label>
</template>
