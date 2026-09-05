<template>
  <!-- L'enveloppe d'un champ : son intitulé et son allure. Voir CLAUDE.md#styling. -->
  <label class="block">
    <span class="text-xs font-medium uppercase tracking-wide text-slate-500">
      {{ label }}
    </span>
    <slot :classes="CLASSES" />
  </label>
</template>

<script setup lang="ts">
defineProps<{ label: string }>()

defineSlots<{
  /** Le contrôle lui-même, qui reçoit l'allure commune à porter. */
  default: (props: { classes: string }) => unknown
}>()

// L'allure du champ, écrite une fois : `<input>`, `<textarea>` et `<select>` ne
// partagent pas de balise, mais portent la même bordure et le même fond.
const CLASSES = 'mt-1 w-full rounded-lg border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:border-indigo-400 focus:outline-none'
</script>
