<template>
  <LoadingProgress
    :loaded="Math.min(loaded, TOTAL)"
    :total="TOTAL"
  />
</template>

<script setup lang="ts">
// Banc de design de l'écran de chargement : le même visuel (LoadingProgress),
// sans fichiers à attendre — la barre se remplit en boucle, pour la regarder
// le temps qu'il faut. Admin seulement.
definePageMeta({ admin: true })

const TOTAL = 40

const loaded = ref(0)

let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  // Un fichier toutes les 150 ms, puis une pause pleine avant de repartir.
  timer = setInterval(() => {
    loaded.value = loaded.value >= TOTAL + 8 ? 0 : loaded.value + 1
  }, 150)
})
onBeforeUnmount(() => clearInterval(timer))
</script>
