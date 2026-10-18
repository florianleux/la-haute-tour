<template>
  <CampOverlay v-slot="{ closing, close }" label="Inventaire" close-label="Fermer l'Inventaire" @close="$emit('close')">
    <!-- Par-dessus le camp (CampOverlay), comme le Grimoire : le sac monte du
         bas et rebondit en se posant. Clic à côté du sac = fermer.

         Le sac garde ses proportions (public/images/inventory-backpack.webp,
         1606×1030, rogné par scripts/img-trim-webp.sh) : jamais étiré, au plus
         large qui tienne, posé en bas de l'écran. Son bas est coupé au ras de
         l'image : le sac continue sous l'écran, et son rebond ne le décolle
         jamais du bord (--rise-lift nul), sinon on verrait la coupe. Il
         s'étire un peu plus que le livre pour compenser.

         Le sac garde ses clics en trois bandes, relevées sur l'image : le
         volet et le corps sous la languette, les oreilles roses, les
         bretelles du bas. Le vide à côté du volet, au-dessus des oreilles,
         ferme.

         Le contenu se posera dans le volet ouvert, au-dessus du nœud : de
         22 % à 78,5 % en largeur, de 17,5 % à 71 % en hauteur. -->
    <CampOverlayFrame
      src="/images/inventory-backpack.webp"
      :closing="closing"
      enter="motion-safe:animate-camp-rise [--rise-lift:0dvh] [--rise-stretch:1.1]"
      leave="motion-safe:animate-sink [--enter-delay:0.1s]"
      :hits="['inset-x-[20%] bottom-0 top-[14%]', 'inset-x-[1%] bottom-[20%] top-[37%]', 'inset-x-[8%] bottom-0 top-[80%]']"
      class="mt-auto aspect-[1606/1030] w-[min(96vw,calc(86dvh*1606/1030))] origin-bottom"
      @close="close"
    >
      <CampOverlayTitle :closing="closing" delay="0.35s" class="top-[1%]">
        Inventaire
      </CampOverlayTitle>
    </CampOverlayFrame>
  </CampOverlay>
</template>

<script setup lang="ts">
// L'Inventaire : le sac du camp (CooldownCamp), ouvert par-dessus lui. Au camp
// seulement. Son contenu reste à écrire. Voir specs/ecrans.md#inventaire.
defineEmits<{ close: [] }>()
</script>
