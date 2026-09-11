<template>
  <img
    :src="source"
    :alt="alt"
    class="object-cover transition"
    :class="dimmed ? 'opacity-40 grayscale' : ''"
    @error="missing = true"
  >
</template>

<script setup lang="ts">
import type { AchievementId } from '~~/shared/utils/achievements'

// Le dessin d'un succès, et son repli. Écrit une fois : la grille et l'annonce
// le montrent toutes les deux, et deux replis séparés finiraient par diverger.
// La taille vient de l'appelant — Vue pose sa classe sur l'image.
const props = withDefaults(defineProps<{
  id: AchievementId
  alt?: string
  /** Le succès n'est pas acquis : le dessin s'éteint. */
  dimmed?: boolean
}>(), { alt: '', dimmed: false })

// L'art arrive après le code : une tuile dont le fichier manque montre le dessin
// de secours plutôt qu'une image cassée.
const missing = ref(false)

const source = computed(() => missing.value ? ACHIEVEMENT_FALLBACK_IMAGE : achievementImage(props.id))
</script>
