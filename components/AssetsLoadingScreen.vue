<template>
  <!-- Pas d'enveloppe plein écran : le <main> du gabarit l'est déjà, centré et sombre. -->
  <div class="flex w-64 flex-col items-center gap-4">
    <p class="text-sm uppercase tracking-widest text-slate-300">
      Chargement
    </p>
    <!-- La barre reste ici tant qu'elle ne sert qu'une fois ; elle deviendra un
         `Base*` le jour où elle resert. -->
    <div
      role="progressbar"
      aria-label="Chargement"
      aria-valuemin="0"
      :aria-valuemax="total"
      :aria-valuenow="loaded"
      class="h-1.5 w-full overflow-hidden rounded-full bg-slate-800"
    >
      <div
        class="h-full rounded-full bg-slate-200 transition-[width] duration-200"
        :style="{ width: `${(loaded / total) * 100}%` }"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
const { loaded, total, start } = useAssetsLoadingScreen()

onMounted(start)
</script>
