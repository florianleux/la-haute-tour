<template>
  <button
    type="button"
    class="group relative cursor-pointer rounded-xl border border-slate-800 bg-slate-900/60 p-2 transition-colors hover:border-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
    :aria-label="label"
    @click="$emit('click')"
  >
    <slot />

    <!--
      L'infobulle n'existe que là où le survol existe : Tailwind garde déjà
      `group-hover` derrière `@media (hover: hover)`, donc un écran tactile ne la
      montre jamais. Sur un tap elle resterait collée par-dessus la grille, sans
      rien pour la fermer — c'est au clic de mener ailleurs.
    -->
    <span
      class="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden w-48 -translate-x-1/2 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-left group-hover:block"
      role="presentation"
    >
      <span class="block text-xs font-semibold text-slate-100">{{ label }}</span>
      <span class="mt-1 block text-xs text-slate-400">{{ hint }}</span>
    </span>
  </button>
</template>

<script setup lang="ts">
// La tuile cliquable d'une grille : son cadre, son focus, et la bulle qui dit ce
// qu'elle est. Ce qu'elle montre vient du slot — elle ne connaît ni image ni
// domaine.
defineProps<{
  /** Ce que la bulle titre, et ce qu'une synthèse vocale lit. */
  label: string
  /** La ligne d'explication sous le titre. */
  hint: string
}>()

defineEmits<{ click: [] }>()
</script>
