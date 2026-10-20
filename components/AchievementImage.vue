<template>
  <img
    v-if="available"
    :src="url"
    :alt="alt"
    class="object-cover"
    @error="missing = true"
  >
  <!-- Le dessin de secours, tant qu'un succès n'a pas le sien : un petit
       bouclier aux couleurs de la guilde (--team-ink, --team-paper, posées par
       le layout). Dessiné ici plutôt que déposé dans
       `public/` : rien à produire ni à committer, et il s'efface de lui-même
       dès que le fichier attendu existe. -->
  <svg
    v-else
    viewBox="0 0 64 64"
    role="img"
    :aria-label="alt || undefined"
  >
    <rect width="64" height="64" class="fill-(--team-ink)" />
    <path
      d="M32 12.5 L47 18.5 V32 C47 42.5 39.5 48.5 32 51.5 C24.5 48.5 17 42.5 17 32 V18.5 Z"
      class="fill-(--team-paper)"
    />
  </svg>
</template>

<script setup lang="ts">
import type { AchievementId } from '~~/shared/utils/achievements'

// Le dessin d'un succès, et son repli. Écrit une fois : la grille et l'annonce
// le montrent toutes les deux, et deux replis séparés finiraient par diverger.
// La taille vient de l'appelant — Vue pose sa classe sur l'image.
const props = withDefaults(defineProps<{
  id: AchievementId
  alt?: string
}>(), { alt: '' })

// L'art arrive après le code : une tuile dont le fichier manque montre le dessin
// de secours plutôt qu'une image cassée. Le manque se lit dans la liste de
// `public/` relevée au build, sans rien demander au réseau : demandées pour
// rien, les tuiles des Haut-faits attendaient chacune leur échec avant de
// s'afficher, l'une après l'autre. `@error` reste pour un fichier listé qui
// n'arrive pas.
const files = useRuntimeConfig().public.assetsLoadingScreenFiles

const missing = ref(false)

const url = computed(() => achievementImage(props.id))
const available = computed(() => !missing.value && files.includes(url.value))
</script>
