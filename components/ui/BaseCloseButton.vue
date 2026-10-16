<template>
  <!-- La croix des boîtes du camp : une croix seule, blanche, une ombre pour
       se détacher du décor flouté. Au survol, elle s'allume et grossit. Sa
       place vient de l'appelant, par `class`. -->
  <button
    type="button"
    :aria-label="label"
    class="cursor-pointer rounded-full p-1 text-white/80 drop-shadow-[0_2px_3px_rgb(0_0_0/0.6)] transition duration-200 ease-out hover:scale-110 hover:text-white focus-visible:scale-110 focus-visible:text-white focus-visible:outline-2 focus-visible:outline-white active:scale-95"
    @click="$emit('click')"
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2.5"
      stroke-linecap="round"
      class="size-10 sm:size-12"
      aria-hidden="true"
    >
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  </button>
</template>

<script setup lang="ts">
defineProps<{
  /** Ce qu'elle ferme, pour une synthèse vocale : « Fermer le Volumen ». */
  label: string
}>()

defineEmits<{ click: [] }>()
</script>
