<template>
  <BaseTileButton :label="label" :hint="condition" @click="$emit('open')">
    <AchievementImage
      :id="id"
      :alt="label"
      :dimmed="unlockedAt === null"
      class="aspect-square w-full rounded-lg"
    />
  </BaseTileButton>
</template>

<script setup lang="ts">
import type { AchievementId } from '~~/shared/utils/achievements'

const props = defineProps<{
  id: AchievementId
  /** Null tant que le succès n'est pas acquis. */
  unlockedAt: string | null
}>()

defineEmits<{ open: [] }>()

const label = computed(() => achievementLabel(props.id))
const condition = computed(() => achievementCondition(props.id))
</script>
