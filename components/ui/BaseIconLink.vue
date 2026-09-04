<script setup lang="ts">
defineProps<{
  to: string
  /** Ce que lit une synthèse vocale : une icône seule ne dit rien d'elle-même. */
  label: string
}>()
</script>

<template>
  <!-- Un lien réduit à son icône. Le cadre du dessin vit ici, pas chez
       l'appelant, qui ne fournit que le tracé : trois icônes côte à côte qui
       divergeraient d'un pixel ou d'une teinte se verraient. -->
  <NuxtLink
    :to="to"
    :aria-label="label"
    :title="label"
    class="text-slate-400 transition-colors hover:text-slate-100"
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      class="h-7 w-7"
      aria-hidden="true"
    >
      <slot />
    </svg>
  </NuxtLink>
</template>
