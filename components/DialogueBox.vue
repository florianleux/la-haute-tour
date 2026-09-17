<template>
  <!-- La boîte, posée sur le bas de la scène et par-dessus les portraits — le
       texte passe devant les personnages, comme sur toute scène de dialogue.
       Tout est en cqw de la scène (voir DialogueScene, qui est le @container) :
       la boîte occupe la même fraction du décor quelle que soit la fenêtre,
       plutôt que de grossir en pixels sur un petit écran. -->
  <div
    class="absolute bottom-[5%] left-1/2 z-20 w-[90%] -translate-x-1/2 rounded-[2cqw] bg-stone-100/95 px-[4cqw] py-[3cqw] shadow-2xl ring-1 ring-black/10 sm:w-[64%] sm:px-[2.4cqw] sm:py-[1.8cqw]"
  >
    <p class="text-[4.4cqw] font-bold text-stone-900 sm:text-[2cqw]">
      {{ name }}
    </p>

    <!-- La hauteur est réservée d'avance : sans elle, la boîte grandirait au fil
         du défilé et sauterait à chaque passage à la réplique suivante. Trois
         lignes, taillées sur les répliques du banc. Rien n'impose ce maximum —
         une quatrième ligne pousserait la boîte vers le haut et rendrait le saut
         que cette réserve supprime, ce qui est le signal qu'une réplique est
         trop longue pour la scène. -->
    <p class="mt-[1.6cqw] min-h-[19.5cqw] text-[4cqw] leading-relaxed text-stone-800 sm:mt-[0.8cqw] sm:min-h-[9.3cqw] sm:text-[1.9cqw]">
      {{ text }}
    </p>

    <!-- Le repère de suite, seul indice que le dialogue attend un geste. Il ne
         paraît qu'une fois la réplique entière sortie : avant, le geste sert à
         la révéler, pas à passer. -->
    <span
      v-if="revealed"
      aria-hidden="true"
      class="absolute bottom-[1.4cqw] right-[3cqw] animate-pulse text-[3.4cqw] text-stone-500 sm:bottom-[0.8cqw] sm:right-[1.6cqw] sm:text-[1.6cqw]"
    >▼</span>
  </div>
</template>

<script setup lang="ts">
// La boîte de dialogue : un nom, le texte qui sort caractère par caractère, et
// le repère qui dit qu'on peut passer. Elle ne sait rien du déroulé — ni quelle
// réplique, ni combien il en reste : on lui donne ce qu'il y a à lire, elle le
// met en page. C'est ce qui la laisse servir un dialogue de boss comme
// n'importe quel autre.
defineProps<{
  /** Qui parle. */
  name: string
  /** Ce qui est sorti de sa réplique — pas la réplique entière. */
  text: string
  /** Elle est sortie en entier : le repère de suite s'allume. */
  revealed: boolean
}>()
</script>
