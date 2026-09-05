<template>
  <!-- La liste encadrée des écrans : bordure, séparateurs et ligne vide écrits
       une fois. Les `<li>` viennent de l'appelant. -->
  <ul class="divide-y divide-slate-800 rounded-xl border border-slate-800">
    <slot />
    <li v-if="empty" class="px-4 py-3 text-sm text-slate-500">
      {{ empty }}
    </li>
  </ul>
</template>

<script setup lang="ts">
defineProps<{
  /**
   * La phrase à afficher quand la liste est vide, ou null quand il n'y a rien à
   * dire — notamment après un échec de lecture : « rien » et « je ne sais pas »
   * ne sont pas la même nouvelle.
   */
  empty?: string | null
}>()
</script>
