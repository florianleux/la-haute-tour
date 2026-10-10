<template>
  <div role="tablist" class="flex gap-2 border-b border-slate-800">
    <button
      v-for="tab in tabs"
      :key="tab.id"
      type="button"
      role="tab"
      :aria-selected="model === tab.id"
      class="-mb-px cursor-pointer border-b-2 px-4 py-2 text-sm font-medium transition-colors"
      :class="model === tab.id
        ? 'border-indigo-400 text-slate-100'
        : 'border-transparent text-slate-400 hover:text-slate-100'"
      @click="model = tab.id"
    >
      {{ tab.label }}
    </button>
  </div>
</template>

<script setup lang="ts" generic="T extends string">
defineProps<{
  /** Les onglets dans l'ordre de la barre ; l'id est ce que porte le v-model. */
  tabs: { id: T, label: string }[]
}>()

// Typé par les ids des onglets : l'appelant garde son union, et un onglet qui
// n'existe pas ne se sélectionne pas.
const model = defineModel<T>({ required: true })
</script>
