<script setup lang="ts">
defineProps<{
  label: string
  value: string | number
}>()
</script>

<template>
  <div class="rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-3">
    <p class="text-xs font-medium uppercase tracking-wide text-slate-500">
      {{ label }}
    </p>
    <p class="mt-1 text-2xl font-bold text-slate-100">
      {{ value }}
    </p>
  </div>
</template>
