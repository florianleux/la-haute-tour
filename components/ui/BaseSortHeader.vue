<template>
  <th class="py-2 pr-4 font-medium" :aria-sort="direction ? ARIA[direction] : undefined">
    <button
      type="button"
      class="inline-flex items-center gap-1 uppercase tracking-wide transition-colors hover:text-slate-200"
      :class="direction ? 'text-slate-200' : ''"
      @click="$emit('sort')"
    >
      <slot />
      <span aria-hidden="true" class="w-2">{{ direction === 'asc' ? '▲' : direction === 'desc' ? '▼' : '' }}</span>
    </button>
  </th>
</template>

<script setup lang="ts">
export type SortDirection = 'asc' | 'desc'

defineProps<{
  /** Le sens du tri si la colonne trie, null sinon. */
  direction: SortDirection | null
}>()

defineEmits<{ sort: [] }>()

const ARIA = { asc: 'ascending', desc: 'descending' } as const
</script>
