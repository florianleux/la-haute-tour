<template>
  <!-- Posée sur le coin haut gauche d'un médaillon : le parent est sa boîte
       carrée, en position relative ou absolue, dans un `@container`. Centrée
       sur le bord du cercle à 45°, la pastille déborde un peu du médaillon. -->
  <span
    class="pointer-events-none absolute left-[15%] top-[15%] flex aspect-square w-[36%] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border bg-gradient-to-br text-[22cqw] font-bold leading-none shadow-[0_1px_3px_rgb(0_0_0/0.4)]"
    :class="count
      ? 'border-amber-700 from-amber-200 via-amber-400 to-amber-500 text-amber-950'
      : 'border-stone-500 from-stone-200 via-stone-300 to-stone-400 text-stone-700'"
  >
    {{ count }}<span class="sr-only"> exemplaire{{ count > 1 ? 's' : '' }} en poche</span>
  </span>
</template>

<script setup lang="ts">
// Le nombre d'exemplaires d'un sort en poche, en pastille dorée, écrite dans
// le brun des titres du Grimoire. Zéro se montre aussi, en gris : un sort
// découvert peut ne plus avoir d'exemplaire. Voir components/SpellPage.vue.

defineProps<{ count: number }>()
</script>
