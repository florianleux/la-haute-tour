<template>
  <LoadingProgress
    :loaded="loaded"
    :total="total"
  />
</template>

<script setup lang="ts">
// L'écran de chargement du jeu, ou celui d'un boss quand on lui donne son
// étage : même écran, d'autres fichiers. Voir specs/spec.md#glossaire.
const props = defineProps<{
  /** L'étage du boss dont attendre les fichiers. Absent, ceux du jeu. */
  floor?: number
}>()

const { loaded, total, start } = props.floor === undefined
  ? useAssetsLoadingScreen()
  : useBossAssetsLoadingScreen(props.floor)

onMounted(start)
</script>
