<template>
  <!-- La vignette ronde des identités. Écrite ici pour qu'aucun écran n'ait à
       poser un `<img>` nu et à réinventer sa taille. -->
  <img
    :src="src"
    :alt="alt"
    :width="small ? 28 : 40"
    :height="small ? 28 : 40"
    loading="lazy"
    :class="small ? 'size-7' : 'size-10'"
    class="shrink-0 rounded-full border border-slate-800 bg-slate-900 object-cover"
  >
</template>

<script setup lang="ts">
defineProps<{
  src: string
  /** Ce que lit une synthèse vocale : le pseudo, pas « avatar ». */
  alt: string
  /** La taille d'une ligne de tableau plutôt que d'une fiche. */
  small?: boolean
}>()
</script>
