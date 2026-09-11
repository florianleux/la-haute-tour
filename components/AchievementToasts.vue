<template>
  <div class="pointer-events-none fixed inset-x-0 top-4 z-50 flex flex-col items-center gap-2 px-4">
    <BaseToast v-for="toast in toasts" :key="toast.key">
      <AchievementImage :id="toast.id" class="size-10 shrink-0 rounded-lg" />
      <span class="min-w-0 flex-1">
        <span class="block text-xs text-slate-400">Succès débloqué</span>
        <span class="block truncate text-sm font-semibold">{{ achievementLabel(toast.id) }}</span>
      </span>
      <BaseButton variant="ghost" @click="dismiss(toast.key)">Fermer</BaseButton>
    </BaseToast>
  </div>
</template>

<script setup lang="ts">
// Monté une fois dans le layout : la file vit au-dessus des pages, sinon une
// navigation pendant l'annonce l'effacerait.
const { toasts, dismiss } = useAchievementToasts()
</script>
