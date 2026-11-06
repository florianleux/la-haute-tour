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
   * `reveal` : un bouton plein, sombre et bordé d'or, en capitales : il se lit
   * sur un voile sombre comme sur le papier clair que la vignette d'un lancer
   * laisse au centre — le OK d'une apparition (ItemReveal, SpellCastBurst).
   * `ink` : un mot souligné à l'encre, sans cadre,
   * à la taille du texte de parchemin où il se pose — les petits gestes alignés
   * à côté d'une ligne (« OK » d'une nouvelle, « Tout marquer lu »).
   */
  variant?: 'primary' | 'ghost' | 'text' | 'option' | 'parchment' | 'reveal' | 'ink'
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
const PADDED = 'px-5 py-3 text-sm font-semibold transition-colors'

// Chaque variante porte sa transition : deux `transition-*` sur un même
// bouton se disputeraient `transition-property`.
const VARIANTS = {
  primary: `${PADDED} bg-indigo-500 text-white hover:bg-indigo-400`,
  ghost: `${PADDED} bg-transparent text-slate-300 hover:bg-slate-800`,
  text: `${PADDED} bg-transparent text-stone-800 hover:underline`,
  option: 'px-5 py-1 italic bg-transparent text-inherit transition-colors hover:underline',
  reveal: 'min-w-[8em] rounded-full! border-2 border-amber-300 bg-stone-950/90 px-8 py-2 text-[max(1.1rem,2.6dvh)] font-semibold tracking-wider uppercase text-amber-200 shadow-[0_2px_10px_rgb(0_0_0/0.6)] transition-colors hover:bg-stone-800 hover:text-amber-100',
  parchment: `${PADDED} border-2 border-amber-900/40 bg-transparent text-amber-950 enabled:hover:bg-amber-900/10`,
  ink: 'font-semibold uppercase tracking-wide bg-transparent text-amber-900 underline decoration-amber-900/40 underline-offset-[0.2em] transition-colors enabled:hover:text-amber-950 enabled:hover:decoration-amber-950',
}

const classes = computed(() => [
  // `relative` : le loader se pose par-dessus le libellé plutôt qu'à côté, pour
  // que le bouton garde sa largeur pendant l'attente.
  'relative inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg',
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400',
  'disabled:cursor-not-allowed disabled:opacity-50',
  props.block ? 'w-full' : '',
  VARIANTS[props.variant],
])
</script>
