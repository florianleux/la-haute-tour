<template>
  <!-- Pas d'enveloppe plein écran : le <main> du gabarit l'est déjà, centré et sombre. -->
  <div class="flex w-[min(36rem,80vw)] flex-col items-center gap-8">
    <!-- L'éclat et la taille des titres du camp (CampOverlayTitle). -->
    <p class="text-[max(3rem,8dvh)]">
      <BaseGlowLabel tone="soft">
        Chargement…
      </BaseGlowLabel>
    </p>
    <div class="relative w-full">
      <div
        role="progressbar"
        aria-label="Chargement"
        aria-valuemin="0"
        :aria-valuemax="total"
        :aria-valuenow="loaded"
        class="h-6 w-full overflow-hidden rounded-full bg-slate-900 p-1 shadow-[inset_0_2px_4px_rgb(0_0_0/0.6),0_0_0_2px_#f5b700,0_0_18px_rgb(255_214_10/0.3)]"
      >
        <div
          class="h-full rounded-full bg-[linear-gradient(180deg,#fff9c4_0%,#ffd60a_40%,#f5a300_100%)] shadow-[0_0_12px_rgb(255_214_10/0.85)] transition-[width] duration-200"
          :style="{ width: `${(loaded / total) * 100}%` }"
        />
      </div>
      <!-- L'étincelle qui court en tête de la barre, au bout de l'or. -->
      <SparkleStar
        glow="#fef3c7"
        class="top-1/2 w-10 -translate-1/2 transition-[left] duration-200 motion-safe:animate-[spin_3s_linear_infinite]"
        :style="{ left: `${(loaded / total) * 100}%` }"
      />
      <SparkleField
        :sparks="SPARKS"
        glow="#fef3c7"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
// Ce que montre l'écran de chargement : le titre doré, la barre et ses
// étincelles. La mécanique (quels fichiers, combien arrivés) vit dans
// AssetsLoadingScreen ; pages/test/loading.vue le montre figé.
defineProps<{
  loaded: number
  total: number
}>()

/** Les étincelles qui scintillent au-dessus et au-dessous de la barre. */
const SPARKS = [
  { left: '6%', top: '-140%', size: '1.25rem', delay: '0s' },
  { left: '27%', top: '120%', size: '1rem', delay: '0.5s' },
  { left: '48%', top: '-160%', size: '1.5rem', delay: '1.1s' },
  { left: '70%', top: '130%', size: '1.1rem', delay: '0.3s' },
  { left: '90%', top: '-130%', size: '1.25rem', delay: '0.8s' },
]
</script>
