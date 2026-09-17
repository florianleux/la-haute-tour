<template>
  <!-- Ancré au bas de la scène, qui le rogne : un portrait de dialogue est cadré
       à mi-corps et sort par le bas du cadre, il n'y flotte pas entier.
       `pointer-events-none` le laisse transparent au clic — c'est la scène qui
       reçoit le geste, pas le personnage. -->
  <img
    :src="speaker.portrait"
    alt=""
    class="pointer-events-none absolute bottom-0 h-[62%] w-auto max-w-[52%] object-contain object-bottom transition duration-300 sm:h-[76%] sm:max-w-[40%]"
    :class="[SIDES[speaker.side], speaking ? '' : 'brightness-50 saturate-50']"
  >
</template>

<script setup lang="ts">
// Un interlocuteur à l'affiche. Les deux côtés passent par ce composant plutôt
// que par deux blocs symétriques recopiés : seule la position change, et une
// copie aurait divergé au premier réglage de cadrage.
//
// Les deux portraits restent affichés tout le dialogue ; c'est le retrait —
// assombri, désaturé — qui dit que ce n'est pas le tour de celui-ci. Le faire
// disparaître à la place ferait clignoter la scène à chaque réplique.
//
// `alt=""` : le nom de celui qui parle est déjà écrit dans la boîte, juste à
// côté. Le décrire ici le ferait lire deux fois par une synthèse vocale.
import type { Speaker } from '~~/utils/dialogue'

const SIDES: Record<Speaker['side'], string> = {
  left: 'left-0',
  right: 'right-0',
}

defineProps<{
  speaker: Speaker
  /** C'est son tour : le portrait sort du retrait. */
  speaking: boolean
}>()
</script>
