<script setup lang="ts">
const props = withDefaults(defineProps<{
  /** Rend un lien plutôt qu'un bouton. */
  to?: string
  variant?: 'primary' | 'ghost'
  disabled?: boolean
}>(), {
  to: undefined,
  variant: 'primary',
  disabled: false,
})

defineEmits<{ click: [MouseEvent] }>()

const classes = computed(() => [
  'inline-flex items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold',
  'transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400',
  'disabled:cursor-not-allowed disabled:opacity-50',
  props.variant === 'primary'
    ? 'bg-indigo-500 text-white hover:bg-indigo-400'
    : 'bg-transparent text-slate-300 hover:bg-slate-800',
])
</script>

<template>
  <NuxtLink v-if="to" :to="to" :class="classes" external>
    <slot />
  </NuxtLink>
  <button v-else type="button" :class="classes" :disabled="disabled" @click="$emit('click', $event)">
    <slot />
  </button>
</template>
