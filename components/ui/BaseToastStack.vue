<template>
  <!-- Sous la barre d'icônes, pas par-dessus : une annonce large recouvrirait
       sinon la coupe et le buste sur un écran étroit. Et `pointer-events-none`
       sur toute la bande : les clics traversent vers l'écran en dessous. Un
       toast qui voudrait être cliquable le redemande pour lui seul
       (`pointer-events-auto`).

       Un popover, montré au montage : il passe dans la couche du dessus, au
       même étage que les boîtes de dialogue (BaseDialog), et par-dessus celle
       déjà ouverte — sans ça, une annonce partie pendant la lecture du Volumen
       restait floutée dessous. D'où les remises à zéro (marge, bordure, fond,
       taille) : un popover arrive avec les siennes. -->
  <div
    ref="stack"
    popover="manual"
    class="pointer-events-none fixed inset-x-0 top-16 bottom-auto m-0 h-auto w-auto flex-col items-center gap-2 overflow-visible border-0 bg-transparent px-4 py-0 open:flex"
  >
    <slot />
  </div>
</template>

<script setup lang="ts">
/** La bande des annonces, au même endroit pour toutes : succès, actions refusées. */
const stack = useTemplateRef<HTMLDivElement>('stack')

onMounted(() => stack.value?.showPopover())
</script>
