<script setup lang="ts">
withDefaults(defineProps<{
  label: string
  placeholder?: string
  rows?: number
}>(), {
  placeholder: undefined,
  rows: 3,
})

const model = defineModel<string>({ required: true })
</script>

<template>
  <BaseField :label="label">
    <template #default="{ classes }">
      <textarea
        v-model="model"
        :rows="rows"
        :placeholder="placeholder"
        :class="classes"
      />
    </template>
  </BaseField>
</template>
