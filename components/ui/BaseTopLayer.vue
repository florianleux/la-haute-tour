<template>
  <!-- Un popover, montré au montage : il passe dans la couche du dessus, au même
       étage que les boîtes de dialogue (BaseDialog), et par-dessus celle déjà
       ouverte. D'où les remises à zéro (marge, cadre, fond, débord) : un
       popover arrive avec les siens. La position et la taille viennent de
       l'appelant, par `class` et `style`. -->
  <div ref="layer" popover="manual" class="m-0 overflow-visible border-0 bg-transparent p-0">
    <slot />
  </div>
</template>

<script setup lang="ts">
// Ce qui doit passer par-dessus une boîte de dialogue ouverte : les annonces
// (BaseToastStack), la bulle d'une tuile (BaseTileButton).
const layer = useTemplateRef<HTMLDivElement>('layer')

onMounted(() => layer.value?.showPopover())
</script>
