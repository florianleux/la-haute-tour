<template>
  <BaseTileButton :label="label" @click="$emit('open')">
    <!-- Au survol, le « ? » prend l'encre de la guilde, celle de son infobulle. -->
    <AchievementIcon
      :id="id"
      :unlocked="unlocked"
      :alt="label"
      class="w-full text-white/85 transition-colors group-hover:text-(--team-ink)"
      :class="!unlocked && 'p-[30%]'"
    />

    <!-- L'icône et le nom côte à côte, un filet, puis la condition. -->
    <template #tip>
      <div class="flex items-center gap-2">
        <AchievementIcon
          :id="id"
          :unlocked="unlocked"
          class="w-14 shrink-0 [filter:drop-shadow(0_2px_3px_rgb(0_0_0/0.3))]"
        />
        <span class="text-base font-bold">{{ label }}</span>
      </div>
      <p class="mt-2 border-t border-current/30 pt-2">
        {{ condition }}
      </p>
    </template>
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

// Pas encore obtenu, un succès ne dit ni son nom ni sa condition : tous sont
// secrets. Voir specs/succes.md#affichage.
const unlocked = computed(() => props.unlockedAt !== null)
const label = computed(() => unlocked.value ? achievementLabel(props.id) : MASKED_TEXT)
const condition = computed(() => unlocked.value ? achievementCondition(props.id) : MASKED_TEXT)
</script>
