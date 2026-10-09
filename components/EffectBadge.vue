<template>
  <SpellTooltip :subject="effect">
    <span
      class="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium"
      :class="PALETTES[effect.face]"
      :aria-label="description"
    >
      <!-- Une étincelle : ce qui vaut pour tout le catalogue tant qu'aucun sort
           n'a de dessin propre. -->
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        class="h-3.5 w-3.5"
        aria-hidden="true"
      >
        <path d="m12 2 1.9 5.6L19.5 9.5l-5.6 1.9L12 17l-1.9-5.6L4.5 9.5l5.6-1.9L12 2Zm6 11 .9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9.9-2.6Z" />
      </svg>
      {{ spellLabel(effect.spell) }}
    </span>
  </SpellTooltip>
</template>

<script setup lang="ts">
// Un effet posé sur le joueur, dit d'un coup d'œil sur les écrans au thème
// sombre : le sort, sa face, et qui l'a lancé. Les écrans de parchemin
// l'écrivent en toutes lettres, voir components/SpellMention.vue.
// Voir specs/bonus.md#ce-que-voit-la-cible-et-ce-que-voit-le-lanceur.
import type { EffectView } from '~~/server/utils/effects'

const PALETTES: Record<EffectView['face'], string> = {
  boon: 'border-emerald-800 bg-emerald-950/40 text-emerald-300',
  curse: 'border-rose-800 bg-rose-950/40 text-rose-300',
}

const props = defineProps<{ effect: EffectView }>()

// Une icône seule ne dit rien d'elle-même, et le nom du lanceur ne tient pas
// dans le badge : il se lit ici par la synthèse vocale, et au survol dans
// l'infobulle.
const description = computed(
  () => `${spellLabel(props.effect.spell)}, lancé par ${props.effect.casterName}`,
)
</script>
