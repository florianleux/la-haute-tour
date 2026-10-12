<template>
  <button
    type="button"
    :aria-pressed="selected"
    class="flex w-full cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 text-left text-sm text-amber-950 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-700 sm:text-base"
    :class="selected ? 'border-amber-800 bg-amber-900/10' : 'border-amber-900/25 hover:bg-amber-900/5'"
    @click="$emit('click')"
  >
    <slot />
  </button>
</template>

<script setup lang="ts">
// Une ligne qu'on choisit dans une liste posée sur un parchemin : son cadre, son
// encre, et la marque de celle qui est choisie. Ce qu'elle montre vient du slot.
defineProps<{
  /** La ligne dont le détail est affiché à côté. */
  selected?: boolean
}>()

defineEmits<{ click: [] }>()
</script>
