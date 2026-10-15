<template>
  <!-- Un bouton réduit à son icône. L'appelant ne fournit que le tracé : le
       cadre du dessin et la pastille au survol vivent ici. -->
  <button
    type="button"
    :aria-label="label"
    class="cursor-pointer rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-100"
    @click="$emit('click', $event)"
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      class="h-5 w-5"
      aria-hidden="true"
    >
      <slot />
    </svg>
  </button>
</template>

<script setup lang="ts">
defineProps<{
  /** Ce que lit une synthèse vocale : une icône seule ne dit rien d'elle-même. */
  label: string
}>()

defineEmits<{ click: [MouseEvent] }>()
</script>
