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
         ferme. -->
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

      <!-- Le volet ouvert, au-dessus du nœud : ce que le sac contient.
           Positions relevées sur l'image. À gauche la grille, à droite la page
           de détail. Voir specs/ecrans.md#inventaire. -->
      <div
        class="absolute bottom-[31.5%] left-[24.5%] right-[23%] top-[20.5%] flex gap-[4%] text-amber-950"
        v-bind="fadeLayer(closing, '0.6s')"
      >
        <!-- La grille : 5 cases de large sur 20 de haut, qui défile. Les cases
             restent dessinées même vides. -->
        <div class="grid w-1/2 shrink-0 grid-cols-5 content-start gap-2 overflow-y-auto pr-[2%] [scrollbar-color:rgb(69_26_3/0.4)_transparent] [scrollbar-width:thin]">
          <div
            v-for="cell in SLOTS"
            :key="cell"
            class="aspect-square rounded-md border-2 border-amber-950/25 bg-amber-950/10"
          />
        </div>

        <!-- La page de détail : l'Objet choisi, une fois les Objets là (#98).
             D'ici là, le sac dit qu'il est vide. -->
        <div class="flex flex-1 items-center justify-center text-center">
          <!-- TODO(texte) : phrase provisoire, Flo l'écrira. -->
          <p class="text-[max(1rem,2.5dvh)] italic text-amber-950/70">
            Rien qu'un peu de poussière au fond du sac.
          </p>
        </div>
      </div>
    </CampOverlayFrame>
  </CampOverlay>
</template>

<script setup lang="ts">
// L'Inventaire : le sac du camp (CooldownCamp), ouvert par-dessus lui. Au camp
// seulement. Vide tant que les Objets n'existent pas (#98). Voir
// specs/ecrans.md#inventaire.
defineEmits<{ close: [] }>()

/** Les cases de la grille : 5 de large sur 20 de haut. */
const SLOTS = 5 * 20
</script>
