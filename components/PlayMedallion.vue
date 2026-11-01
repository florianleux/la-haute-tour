<template>
  <!-- Le médaillon, à cheval sur le bord haut de sa carte : chrono pendant la
       question, juste/faux sur le verdict. Sa place, sa taille et son dessin
       arrivent par `class`, que Vue fusionne ici. -->
  <div
    class="absolute left-1/2 z-20 origin-bottom -translate-x-1/2 -translate-y-1/2 @container bg-contain bg-center bg-no-repeat"
    :style="{ aspectRatio: ratio }"
  >
    <!-- Le chiffre au centre du disque, dont la hauteur n'est pas la même
         d'un dessin à l'autre : mesurée sur l'image, pas estimée. `leading-none`
         pour que la boîte de ligne colle aux chiffres — sans lui, l'espace
         réservé aux jambages la fait porter haut dans le disque. -->
    <div
      class="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 leading-none"
      :class="ink"
    >
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
// Le médaillon des cartes de jeu : celui de PlayFrame (ascension, rattrapage)
// et celui de l'épreuve du boss (BossFlagTrial), écrit une fois.
defineProps<{
  /** Le format du dessin, largeur / hauteur de l'image. */
  ratio: string
  /** La hauteur et la taille du chiffre dans le disque. */
  ink: string
}>()
</script>
