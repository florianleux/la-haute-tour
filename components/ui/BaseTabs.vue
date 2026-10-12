<template>
  <div role="tablist" class="flex gap-2 border-b" :class="parchment ? 'border-amber-900/20' : 'border-slate-800'">
    <button
      v-for="tab in tabs"
      :key="tab.id"
      type="button"
      role="tab"
      :aria-selected="model === tab.id"
      class="-mb-px cursor-pointer border-b-2 px-4 py-2 text-sm font-medium transition-colors"
      :class="model === tab.id ? INK.selected : INK.idle"
      @click="model = tab.id"
    >
      {{ tab.label }}
    </button>
  </div>
</template>

<script setup lang="ts" generic="T extends string">
const props = defineProps<{
  /** Les onglets dans l'ordre de la barre ; l'id est ce que porte le v-model. */
  tabs: { id: T, label: string }[]
  /** Posés sur un parchemin : encre sombre sur papier clair. */
  parchment?: boolean
}>()

const INK = computed(() => (props.parchment
  ? { selected: 'border-amber-800 text-amber-950', idle: 'border-transparent text-amber-900/50 hover:text-amber-950' }
  : { selected: 'border-indigo-400 text-slate-100', idle: 'border-transparent text-slate-400 hover:text-slate-100' }))

// Typé par les ids des onglets : l'appelant garde son union, et un onglet qui
// n'existe pas ne se sélectionne pas.
const model = defineModel<T>({ required: true })
</script>
