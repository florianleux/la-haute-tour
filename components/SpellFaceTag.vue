<template>
  <span class="inline-block rounded border px-1.5 py-px font-medium" :class="FACE_TONES[face]">{{ spellFaceLabel(face) }}</span>
</template>

<script setup lang="ts">
// L'étiquette d'une face de sort, magie blanche ou noire. Partagée par
// l'infobulle d'un sort (SpellDetails) et la page droite du Grimoire
// (SpellbookDetails).
import type { SpellFace } from '~~/shared/utils/spells'

defineProps<{ face: SpellFace }>()

const FACE_TONES: Record<SpellFace, string> = {
  boon: 'border-sky-500/50 bg-sky-100 text-sky-800',
  curse: 'border-violet-700/40 bg-violet-100 text-violet-900',
}
</script>
