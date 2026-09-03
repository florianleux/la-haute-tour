<script setup lang="ts">
withDefaults(defineProps<{
  /** Taille du trait : dans un bouton (sm) ou seule dans la page (md). */
  size?: 'sm' | 'md'
  label?: string
}>(), {
  size: 'sm',
  label: 'Chargement en cours',
})
</script>

<template>
  <span class="inline-flex items-center gap-2" role="status">
    <span
      class="animate-spin rounded-full border-current border-t-transparent"
      :class="size === 'sm' ? 'size-4 border-2' : 'size-6 border-[3px]'"
    />
    <span class="sr-only">{{ label }}</span>
    <slot />
  </span>
</template>
