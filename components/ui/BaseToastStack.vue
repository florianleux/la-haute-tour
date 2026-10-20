<template>
  <!-- Sous le sélecteur d'incarnation de l'admin, pas par-dessus : une annonce
       large le recouvrirait sinon sur un écran étroit. Et `pointer-events-none`
       sur toute la bande : les clics traversent vers l'écran en dessous. Un
       toast qui voudrait être cliquable le redemande pour lui seul
       (`pointer-events-auto`).

       Dans la couche du dessus (BaseTopLayer) — sans ça, une annonce partie
       pendant la lecture du Volumen restait floutée dessous. -->
  <BaseTopLayer
    class="pointer-events-none fixed inset-x-0 top-16 bottom-auto h-auto w-auto flex-col gap-2 open:flex"
    :class="edge ? 'items-end' : 'items-center px-4'"
  >
    <slot />
  </BaseTopLayer>
</template>

<script setup lang="ts">
/** La bande des annonces, au même endroit pour toutes : succès, actions refusées. */
defineProps<{
  /** Collée au bord droit, sans marge : pour une annonce qui entre par là (les succès). */
  edge?: boolean
}>()
</script>
