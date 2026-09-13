<template>
  <!-- Sous la barre d'icônes, pas par-dessus : une annonce large recouvrirait
       sinon la coupe et le buste sur un écran étroit. Et `pointer-events-none`
       sur toute la bande, qui n'a plus rien de cliquable depuis qu'un succès ne
       se ferme plus à la main : les clics traversent vers l'écran en dessous.
       La règle est ici et pas dans BaseToast, qui n'a pas à interdire à un
       futur toast d'être cliquable. -->
  <div class="pointer-events-none fixed inset-x-0 top-16 z-50 flex flex-col items-center gap-2 px-4">
    <BaseToast v-for="toast in toasts" :key="toast.key">
      <AchievementImage :id="toast.id" class="size-10 shrink-0 rounded-lg" />
      <span class="min-w-0 flex-1">
        <span class="block text-xs text-slate-400">Succès débloqué</span>
        <span class="block truncate text-sm font-semibold">{{ achievementLabel(toast.id) }}</span>
      </span>
    </BaseToast>
  </div>
</template>

<script setup lang="ts">
// Monté une fois dans le layout : la file vit au-dessus des pages, sinon une
// navigation pendant l'annonce l'effacerait.
const toasts = useAchievementToasts()
</script>
