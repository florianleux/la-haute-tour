<script setup lang="ts">
import type { NavIconState } from '~/utils/nav'

const props = withDefaults(defineProps<{
  to: string
  /** Ce que lit une synthèse vocale : une icône seule ne dit rien d'elle-même. */
  label: string
  /** Lien, page regardée, ou page qu'on ne peut pas atteindre maintenant. */
  state?: NavIconState
}>(), { state: 'link' })

// Seul un lien est un lien : la page qu'on regarde et celle qu'on ne peut pas
// atteindre ne mènent nulle part, donc ni clic, ni focus au clavier, ni ancre à
// ouvrir dans un onglet. Voir specs/ecrans.md#principes.
//
// Résolu dans le setup, pas dans le computed : resolveComponent() n'est garanti
// que là, et rendrait sinon la chaîne brute.
const link = resolveComponent('NuxtLink')
const tag = computed(() => (props.state === 'link' ? link : 'span'))

// Éteinte, mise en avant, ou entre les deux : les trois états se distinguent à
// l'œil, sans quoi une icône inerte passerait pour un lien mort.
const TONES: Record<NavIconState, string> = {
  link: 'text-slate-400 hover:text-slate-100',
  active: 'text-slate-100',
  disabled: 'text-slate-700',
}

const tone = computed(() => TONES[props.state])
</script>

<template>
  <!-- Un lien réduit à son icône. Le cadre du dessin vit ici, pas chez
       l'appelant, qui ne fournit que le tracé : quatre icônes côte à côte qui
       divergeraient d'un pixel ou d'une teinte se verraient. -->
  <component
    :is="tag"
    :to="state === 'link' ? to : undefined"
    :aria-label="label"
    :title="label"
    :aria-current="state === 'active' ? 'page' : undefined"
    :aria-disabled="state === 'disabled' ? 'true' : undefined"
    class="transition-colors"
    :class="tone"
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      class="h-7 w-7"
      aria-hidden="true"
    >
      <slot />
    </svg>
  </component>
</template>
