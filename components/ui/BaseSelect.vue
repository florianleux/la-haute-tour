<script setup lang="ts">
export interface SelectOption {
  value: string
  label: string
}

defineProps<{
  label: string
  options: SelectOption[]
}>()

// Une valeur de `<select>` est une chaîne : l'appelant convertit s'il attend
// autre chose, plutôt que de laisser deux conversions vivre côte à côte.
const model = defineModel<string>({ required: true })
</script>

<template>
  <BaseField :label="label">
    <template #default="{ classes }">
      <select v-model="model" :class="classes">
        <option v-for="option in options" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
      </select>
    </template>
  </BaseField>
</template>
