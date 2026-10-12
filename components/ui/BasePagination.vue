<template>
  <!-- Une seule page n'a rien à paginer : la barre ne s'affiche pas. -->
  <nav
    v-if="pageCount > 1"
    aria-label="Pagination"
    class="flex flex-wrap items-center justify-center gap-1"
  >
    <BaseButton
      :variant="idle"
      :disabled="disabled || model === 1"
      aria-label="Page précédente"
      @click="model = model - 1"
    >
      ‹
    </BaseButton>
    <template v-for="(item, index) in items" :key="index">
      <span v-if="item === null" class="px-2" :class="parchment ? 'text-amber-900/50' : 'text-slate-500'">…</span>
      <BaseButton
        v-else
        :variant="item === model ? current : idle"
        :class="parchment && item === model ? 'underline' : ''"
        :disabled="disabled"
        :aria-current="item === model ? 'page' : undefined"
        @click="model = item"
      >
        {{ item }}
      </BaseButton>
    </template>
    <BaseButton
      :variant="idle"
      :disabled="disabled || model === pageCount"
      aria-label="Page suivante"
      @click="model = model + 1"
    >
      ›
    </BaseButton>
  </nav>
</template>

<script setup lang="ts">
const props = defineProps<{
  pageCount: number
  /** Une page est en route : on n'en demande pas une autre par-dessus. */
  disabled?: boolean
  /** Posée sur un parchemin : le libellé seul, la page courante soulignée. */
  parchment?: boolean
}>()

const current = computed(() => (props.parchment ? 'text' : 'primary'))
const idle = computed(() => (props.parchment ? 'text' : 'ghost'))

/** La page affichée, de 1 à `pageCount`. */
const model = defineModel<number>({ required: true })

// Toutes les pages ne tiennent pas sur un écran de téléphone : la première, la
// dernière, et la courante entourée de ses voisines. Null marque un trou.
const items = computed((): (number | null)[] => {
  const shown = [...new Set([1, model.value - 1, model.value, model.value + 1, props.pageCount])]
    .filter(page => page >= 1 && page <= props.pageCount)
    .sort((a, b) => a - b)

  return shown.flatMap((page, index) => (index > 0 && page - shown[index - 1] > 1 ? [null, page] : [page]))
})
</script>
