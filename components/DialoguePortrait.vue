<template>
  <!-- `pointer-events-none` le laisse transparent au clic — c'est la scène qui
       reçoit le geste, pas le personnage.

       En mobile il est dans le flux, aux côtés de l'autre sous la réplique :
       c'est lui qui donne sa hauteur à la carte, qui s'arrête donc à ses pieds
       au lieu de laisser un vide.

       En desktop (`wide:`) il s'ancre au bas de la fenêtre, qui le rogne : cadré
       à mi-corps, il sort par le bas du cadre plutôt que d'y flotter entier, et
       la boîte (z-20) lui passe devant.

       `origin-bottom` : c'est le seul point qui ne doit pas bouger quand il
       grandit, sinon il décollerait du bas à chaque réplique. `z-10` sur celui
       qui parle — agrandi, il passe devant l'autre plutôt que dessous, mais
       reste sous la boîte.

       Un interlocuteur dispensé de retrait (`retreats: false`) garde l'allure
       de celui qui parle, mais pas son `z-10` : quand l'autre parle, c'est
       l'autre qui passe devant. -->
  <img
    :src="speaker.portrait"
    alt=""
    class="pointer-events-none h-[34.5svh] w-auto max-w-[53%] origin-bottom object-contain object-bottom transition duration-300 wide:absolute wide:bottom-0 wide:h-[90%] wide:max-w-[42.5%]"
    :class="[
      PLACES[place],
      { 'z-10': speaking },
      speaking || speaker.retreats === false ? 'scale-105 brightness-100 saturate-100' : 'scale-[0.76] brightness-75 saturate-50',
    ]"
  >
</template>

<script setup lang="ts">
// Un interlocuteur à l'affiche. Les trois places passent par ce composant plutôt
// que par des blocs recopiés : seul l'ancrage change, et une copie aurait
// divergé au premier réglage de cadrage.
//
// Les deux portraits d'un dialogue à deux restent affichés tout du long ; c'est
// la taille et la couleur qui disent à qui est le tour — celui qui parle se
// redresse et retrouve ses teintes, l'autre recule d'un cran, se délave et
// s'assombrit. Pas de transparence : le décor se lirait au travers du
// personnage. Le faire
// disparaître ferait clignoter la scène à chaque réplique.
//
// `alt=""` : le nom de celui qui parle est déjà écrit dans la boîte, juste à
// côté. Le décrire ici le ferait lire deux fois par une synthèse vocale.
import type { SpeakerPlace, Speaker } from '~~/utils/dialogue'

// Les classes sont écrites en entier, jamais construites par concaténation :
// Tailwind ne voit que ce qui est littéral dans le source.
// Les places ne valent qu'en desktop : en mobile les portraits sont côte à côte
// dans le flux, et c'est leur ordre qui les range.
const PLACES: Record<SpeakerPlace, string> = {
  left: 'wide:left-0',
  right: 'wide:right-0',
  center: 'wide:left-1/2 wide:-translate-x-1/2',
}

defineProps<{
  speaker: Speaker
  /** Où il se tient : les deux bords, ou le milieu quand il est seul en scène. */
  place: SpeakerPlace
  /** C'est son tour : le portrait sort du retrait. */
  speaking: boolean
}>()
</script>
