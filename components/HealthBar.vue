<template>
  <!-- La taille du nom vient de l'appelant (`class` sur la racine) : le boss
       s'annonce plus gros que le joueur. -->
  <div class="pointer-events-none">
    <p class="mb-2 font-serif leading-none tracking-wide text-amber-50 [text-shadow:0_1px_3px_black]">
      {{ name }}
    </p>
    <div
      class="relative h-4 rounded-xs border-2 border-amber-400 bg-black/85 shadow-[0_0_0_1px_rgb(120_53_15),0_3px_8px_black]"
      role="progressbar"
      :aria-label="`Vie de ${name}`"
      :aria-valuenow="value"
      aria-valuemin="0"
      :aria-valuemax="max"
    >
      <div
        class="absolute inset-y-0 left-0 bg-amber-100/80 transition-[width] delay-500 duration-700 ease-out"
        :style="{ width }"
      />
      <div
        class="absolute inset-y-0 left-0 bg-linear-to-b from-red-600 to-red-900 transition-[width] duration-150"
        :style="{ width }"
      />
      <!-- Une barre en cases : un filet d'or entre chaque point de vie. -->
      <div
        v-for="n in segmented ? max - 1 : 0"
        :key="n"
        class="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-amber-400"
        :style="{ left: `${(n / max) * 100}%` }"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
// Une barre de vie à la Dark Souls : le nom, puis une barre rouge cerclée d'or.
// Un point perdu part d'un coup ; la traînée claire derrière suit avec retard
// et montre ce qui vient de tomber. Celle du boss et celle du joueur au combat.
const props = defineProps<{
  name: string
  value: number
  max: number
  /** Coupée en cases, une par point : pour peu de points, qu'on compte d'un coup d'œil. */
  segmented?: boolean
}>()

const width = computed(() => `${(props.value / props.max) * 100}%`)
</script>
