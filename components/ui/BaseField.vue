<template>
  <!-- L'enveloppe d'un champ : son intitulé et son allure. Voir CLAUDE.md#styling. -->
  <label class="block">
    <span class="text-xs font-medium uppercase tracking-wide text-slate-500">
      {{ label }}
    </span>
    <slot :classes="clear ? CLEAR : DARK" />
  </label>
</template>

<script setup lang="ts">
defineProps<{
  label: string
  /** Sans fond, texte sombre : pour un champ posé sur une surface claire. */
  clear?: boolean
}>()

defineSlots<{
  /** Le contrôle lui-même, qui reçoit l'allure commune à porter. */
  default: (props: { classes: string }) => unknown
}>()

// L'allure du champ, écrite une fois : `<input>`, `<textarea>` et `<select>` ne
// partagent pas de balise, mais portent la même bordure et le même fond.
// Deux allures écrites en entier, jamais surchargées l'une par l'autre : en
// Tailwind, deux classes de fond sur un même élément, c'est l'ordre de la
// feuille de style qui tranche, pas celui de l'attribut.
const BASE = 'mt-1 w-full rounded-lg border px-4 py-3 text-sm focus:outline-none'
const DARK = `${BASE} border-slate-800 bg-slate-950/60 text-slate-100 placeholder:text-slate-600 focus:border-indigo-400`
const CLEAR = `${BASE} border-stone-400 bg-transparent text-stone-800 placeholder:text-stone-400 focus:border-stone-800`
</script>
