<template>
  <BaseField v-if="label" :label="label">
    <template #default="{ classes }">
      <select v-model="model" :class="classes" :disabled="disabled">
        <option v-for="option in options" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
      </select>
    </template>
  </BaseField>

  <select
    v-else
    v-model="model"
    :disabled="disabled"
    class="cursor-pointer rounded-lg border px-2 py-1 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50"
    v-bind="$attrs"
  >
    <option v-for="option in options" :key="option.value" :value="option.value">
      {{ option.label }}
    </option>
  </select>
</template>

<script setup lang="ts">
export interface SelectOption {
  value: string
  label: string
}

defineProps<{
  /**
   * Le libellé au-dessus du champ. Absent, le select se rend nu — il vit alors
   * dans une barre plutôt que dans un formulaire, et c'est `aria-label` qui le
   * nomme. Un `<select>` brut ne s'écrit nulle part ailleurs.
   */
  label?: string
  options: SelectOption[]
  disabled?: boolean
}>()

// Une valeur de `<select>` est une chaîne : l'appelant convertit s'il attend
// autre chose, plutôt que de laisser deux conversions vivre côte à côte.
const model = defineModel<string>({ required: true })
</script>
