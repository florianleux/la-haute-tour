<template>
  <!-- La bande (BaseToastStack) laisse passer les clics : un succès ne se ferme
       plus à la main, il n'a rien de cliquable. Montée seulement quand un succès
       arrive : c'est à son montage qu'elle passe par-dessus une boîte de
       dialogue déjà ouverte. -->
  <BaseToastStack v-if="toasts.length">
    <BaseToast v-for="toast in toasts" :key="toast.key">
      <AchievementImage :id="toast.id" class="size-10 shrink-0 rounded-lg" />
      <span class="min-w-0 flex-1">
        <span class="block text-xs text-slate-400">Succès débloqué</span>
        <span class="block truncate text-sm font-semibold">{{ achievementLabel(toast.id) }}</span>
      </span>
    </BaseToast>
  </BaseToastStack>
</template>

<script setup lang="ts">
// Monté une fois dans le layout : la file vit au-dessus des pages, sinon une
// navigation pendant l'annonce l'effacerait.
const toasts = useAchievementToasts()
</script>
