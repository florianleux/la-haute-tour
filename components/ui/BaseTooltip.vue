<template>
  <!-- La bulle d'une infobulle : son cadre, son fond, son texte. Aux couleurs
       de la guilde du joueur (--team-ink, --team-paper, posées par le layout).
       La position, la largeur et l'apparition au survol
       viennent de l'appelant, par `class` et `style`. -->
  <div class="rounded-md border-2 border-(--team-ink) bg-(--team-paper) p-3 text-left text-sm leading-snug text-(--team-ink) shadow-[inset_2px_2px_0_rgb(255_255_255/0.8),inset_-2px_-2px_0_color-mix(in_srgb,var(--team-ink)_35%,transparent),0_10px_24px_rgb(0_0_0/0.45)]">
    <slot />
  </div>
</template>

<script setup lang="ts">
// Une seule bulle pour toutes les infobulles : celle d'un sort (SpellTooltip)
// et celle d'une tuile (BaseTileButton, les Haut-faits).
</script>
