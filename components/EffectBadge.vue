<template>
  <span
    class="inline-flex items-center rounded-full border font-medium"
    :class="[SHAPES[theme], PALETTES[theme][effect.face]]"
    :title="description"
    :aria-label="description"
  >
    <!-- Une étincelle : ce qui vaut pour tout le catalogue tant qu'aucun sort
         n'a de dessin propre. -->
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      :class="theme === 'parchment' ? 'h-[2cqw] w-[2cqw]' : 'h-3.5 w-3.5'"
      aria-hidden="true"
    >
      <path d="m12 2 1.9 5.6L19.5 9.5l-5.6 1.9L12 17l-1.9-5.6L4.5 9.5l5.6-1.9L12 2Zm6 11 .9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9.9-2.6Z" />
    </svg>
    {{ spellLabel(effect.spell) }}
  </span>
</template>

<script setup lang="ts">
// Un effet posé sur le joueur, dit d'un coup d'œil : le sort, sa face, et qui
// l'a lancé. Le même badge sert au récapitulatif de l'attente et aux icônes de
// l'ascension — deux lectures du même état, pas deux dessins.
// Voir specs/bonus.md#ce-que-voit-la-cible-et-ce-que-voit-le-lanceur.
//
// `theme` — et non `tone`, déjà pris dans ce repo pour le jugement porté
// (success/danger/warning, voir utils/tone.ts) : ici il ne s'agit que du fond sur
// lequel le badge se pose. `dark` pour les écrans au thème sombre, `parchment`
// pour ceux qui sont reskinés, où les tailles se comptent en cqw et où les tons
// saturés du thème sombre seraient illisibles.
import type { EffectView } from '~~/server/utils/effects'

type BadgeTheme = 'dark' | 'parchment'

const SHAPES: Record<BadgeTheme, string> = {
  dark: 'gap-1.5 px-3 py-1 text-xs',
  parchment: 'gap-[0.8cqw] px-[1.8cqw] py-[0.6cqw] text-[2.1cqw]',
}

const PALETTES: Record<BadgeTheme, Record<EffectView['face'], string>> = {
  dark: {
    boon: 'border-emerald-800 bg-emerald-950/40 text-emerald-300',
    curse: 'border-rose-800 bg-rose-950/40 text-rose-300',
  },
  parchment: {
    boon: 'border-emerald-900/40 bg-emerald-900/10 text-emerald-900',
    curse: 'border-rose-900/40 bg-rose-900/10 text-rose-900',
  },
}

const props = withDefaults(defineProps<{
  effect: EffectView
  theme?: BadgeTheme
}>(), { theme: 'dark' })

// Une icône seule ne dit rien d'elle-même, et le nom du lanceur ne tient pas
// dans le badge : il se lit ici, par la synthèse vocale comme au survol.
const description = computed(
  () => `${spellLabel(props.effect.spell)}, lancé par ${props.effect.casterName}`,
)
</script>
