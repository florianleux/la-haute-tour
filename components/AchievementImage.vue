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
// de secours plutôt qu'une image cassée. Le manque se lit dans la liste de
// `public/` relevée au build, sans rien demander au réseau : demandées pour
// rien, les cinquante tuiles des Haut-faits attendaient chacune leur échec avant
// de s'afficher, l'une après l'autre. `@error` reste pour un fichier listé qui
// n'arrive pas.
const files = useRuntimeConfig().public.assetsLoadingScreenFiles

const missing = ref(false)

const source = computed(() => {
  const url = achievementImage(props.id)

  return missing.value || !files.includes(url) ? ACHIEVEMENT_FALLBACK_IMAGE : url
})
</script>
