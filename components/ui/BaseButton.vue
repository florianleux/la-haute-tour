<template>
  <NuxtLink v-if="to" :to="to" :class="classes" :external="external">
    <slot />
  </NuxtLink>
  <button
    v-else
    type="button"
    :class="classes"
    :disabled="disabled || loading"
    :aria-busy="loading"
    @click="$emit('click', $event)"
  >
    <!-- Le libellé reste en place, invisible : il tient la largeur du bouton, et
         le loader prend sa place au lieu de s'ajouter à côté. -->
    <span class="contents" :class="loading ? 'invisible' : ''">
      <slot />
    </span>
    <BaseSpinner v-if="loading" class="absolute inset-0 justify-center" />
  </button>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  /** Rend un lien plutôt qu'un bouton. */
  to?: string
  /** Cible hors du routeur (route serveur, site tiers) : navigation complète. */
  external?: boolean
  /** Occupe toute la largeur disponible. */
  block?: boolean
  /** Action en cours : le bouton montre un loader et refuse un second clic. */
  loading?: boolean
  /**
   * `text` : le libellé seul, sans fond, pour une surface claire. `option` :
   * pareil, en italique et resserré, pour une réponse parmi d'autres empilées —
   * à la taille et à la couleur du texte qui l'entoure, qu'elle reprend plutôt
   * que d'imposer les siennes. `parchment` : un bouton tracé à l'encre, pour
   * une action posée sur du papier (le Grimoire), où les fonds sombres jurent.
   * `link` : un simple lien blanc, en capitales, posé sur un voile sombre — le
   * OK d'une apparition (ItemReveal, SpellCastBurst).
   */
  variant?: 'primary' | 'ghost' | 'text' | 'option' | 'parchment' | 'link'
  disabled?: boolean
}>(), {
  to: undefined,
  external: false,
  block: false,
  loading: false,
  variant: 'primary',
  disabled: false,
})

defineEmits<{ click: [MouseEvent] }>()

/**
 * Le gabarit d'un bouton seul. Une option, empilée avec d'autres dans un texte,
 * en veut un plus serré et garde la taille de ce texte.
 */
const PADDED = 'py-3 text-sm font-semibold transition-colors'

// Chaque variante porte sa transition : deux `transition-*` sur un même
// bouton se disputeraient `transition-property`.
const VARIANTS = {
  primary: `${PADDED} bg-indigo-500 text-white hover:bg-indigo-400`,
  ghost: `${PADDED} bg-transparent text-slate-300 hover:bg-slate-800`,
  text: `${PADDED} bg-transparent text-stone-800 hover:underline`,
  option: 'py-1 italic bg-transparent text-inherit transition-colors hover:underline',
  link: 'py-1 text-[max(1.1rem,2.6dvh)] font-semibold tracking-wider uppercase bg-transparent text-white underline-offset-4 transition-opacity hover:underline hover:opacity-80',
  parchment: `${PADDED} border-2 border-amber-900/40 bg-transparent text-amber-950 enabled:hover:bg-amber-900/10`,
}

const classes = computed(() => [
  // `relative` : le loader se pose par-dessus le libellé plutôt qu'à côté, pour
  // que le bouton garde sa largeur pendant l'attente.
  'relative inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg px-5',
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400',
  'disabled:cursor-not-allowed disabled:opacity-50',
  props.block ? 'w-full' : '',
  VARIANTS[props.variant],
])
</script>
