<template>
  <div
    class="flex min-w-36 flex-col justify-center py-2 text-center"
    :class="[sideClass, toneClass]"
  >
    <slot />
  </div>
</template>

<script setup lang="ts">
// La bannière héraldique de l'écran de question, en ascension. Une pointe
// simple s'accroche vers la carte, deux pointes (une fourche) marquent le bout
// libre — d'où les deux polygones, un par côté. Réservée à cet écran pour
// l'instant : voir pages/index.vue.
const props = withDefaults(defineProps<{
  side: 'left' | 'right'
  tone?: 'wine' | 'gold' | 'forest'
}>(), { tone: 'wine' })

// Les classes sont écrites en entier, jamais composées par bout : le
// compilateur Tailwind lit le texte du fichier, pas la valeur au runtime — une
// classe reconstituée par concaténation ne serait jamais générée.
const LEFT_SHAPE = 'pl-6 pr-9 [clip-path:polygon(0_0,25px_50%,0_100%,calc(100%_-_20px)_100%,100%_50%,calc(100%_-_20px)_0)]'
const RIGHT_SHAPE = 'pl-9 pr-6 [clip-path:polygon(0_50%,16px_0,100%_0,calc(100%_-_25px)_50%,100%_100%,16px_100%)]'

const sideClass = computed(() => (props.side === 'left' ? LEFT_SHAPE : RIGHT_SHAPE))

const toneClass = computed(() => ({
  wine: 'bg-rose-500 text-rose-900 border-4 border-color-bg-rose-900',
  gold: 'bg-amber-500 text-stone-900',
  forest: 'bg-emerald-500 text-emerald-900 border-4 border-color-bg-rose-900',
}[props.tone]))
</script>
