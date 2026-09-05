<template>
  <BaseField :label="label">
    <template #default="{ classes }">
      <input
        v-model="model"
        type="text"
        :placeholder="placeholder"
        :class="classes"
      >
    </template>
  </BaseField>
</template>

<script setup lang="ts">
defineProps<{
  label: string
  placeholder?: string
}>()

const model = defineModel<string>({ required: true })
</script>
