<template>
  <!-- La croix des boîtes du camp, dessinée comme le décor : une pastille
       rouge cernée de brun, une ombre décalée, une croix blanche cernée elle
       aussi. Au survol, elle grossit, penche, et son rouge s'allume. Sa place
       vient de l'appelant, par `class`. -->
  <button
    type="button"
    :aria-label="label"
    class="group cursor-pointer rounded-full transition-transform duration-200 ease-out hover:-rotate-12 hover:scale-110 focus-visible:-rotate-12 focus-visible:scale-110 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-white active:scale-95"
    @click="$emit('click')"
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      class="size-14 sm:size-16"
      aria-hidden="true"
    >
      <circle cx="34" cy="36" r="26" fill="#2a0b14" fill-opacity="0.45" />
      <circle
        cx="32"
        cy="32"
        r="26"
        stroke="#3b0d1c"
        stroke-width="4"
        class="fill-rose-700 transition-colors duration-200 group-hover:fill-rose-500 group-focus-visible:fill-rose-500"
      />
      <path d="M15 27a18 18 0 0 1 13-12" fill="none" stroke="#fff" stroke-opacity="0.55" stroke-width="4" stroke-linecap="round" />
      <path d="M23 23 41 41M41 23 23 41" stroke="#3b0d1c" stroke-width="12" stroke-linecap="round" />
      <path d="M23 23 41 41M41 23 23 41" stroke="#fff" stroke-width="6" stroke-linecap="round" />
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
