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
  variant?: 'primary' | 'ghost'
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

const classes = computed(() => [
  // `relative` : le loader se pose par-dessus le libellé plutôt qu'à côté, pour
  // que le bouton garde sa largeur pendant l'attente.
  'relative inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold',
  'transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400',
  'disabled:cursor-not-allowed disabled:opacity-50',
  props.block ? 'w-full' : '',
  props.variant === 'primary'
    ? 'bg-indigo-500 text-white hover:bg-indigo-400'
    : 'bg-transparent text-slate-300 hover:bg-slate-800',
])
</script>
