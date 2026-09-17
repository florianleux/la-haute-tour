<template>
  <!-- Le décor, fixe : ancré au viewport et non au document, sinon le moindre
       rebond de scroll le fait glisser sous la scène. Même ancrage que
       PlayFrame, pour la même raison. -->
  <div
    class="fixed inset-0 z-0 bg-cover bg-center"
    :style="{ backgroundImage: `url('${dialogue.background}')` }"
  />

  <div class="relative z-10 mx-auto w-full max-w-5xl">
    <!-- La scène : un cadre dont `@container` fait l'unité `cqw` de tout ce
         qu'elle porte. Portraits et boîte gardent ainsi leur composition à toute
         taille de fenêtre, au lieu de se recomposer écran par écran.

         En mobile elle se règle sur la hauteur de l'écran plutôt que sur une
         proportion : un 16/9 y tiendrait dans une bande de 220 px où ni les
         personnages ni le texte ne seraient lisibles. `svh` et non `vh` — la
         barre d'adresse mobile se rétracte au scroll, et `vh` fait alors
         dépasser la scène du bas de l'écran. En desktop, le format connu
         reprend : la fenêtre y est plus large que haute, c'est la largeur qui
         manque. -->
    <div class="relative mx-auto h-[78svh] w-full overflow-hidden @container sm:h-auto sm:aspect-16/9">
      <template v-if="solo">
        <DialoguePortrait
          :speaker="solo"
          place="center"
          speaking
        />
      </template>
      <template v-else-if="pair">
        <DialoguePortrait
          v-for="portrait in pair"
          :key="portrait.place"
          :speaker="portrait.speaker"
          :place="portrait.place"
          :speaking="place === portrait.place"
        />
      </template>

      <DialogueBox
        :name="speaker.name"
        :text="shown"
        :revealed="revealed"
      />

      <!-- Toute la scène fait bouton : c'est le geste du genre, et il évite au
           joueur de viser une cible. Un vrai <button> plutôt qu'un div qui
           écoute le clic — il apporte le focus, Entrée, Espace et l'annonce en
           synthèse vocale, qu'il faudrait sinon réécrire à la main. Posé par
           dessus le reste, et non autour, pour ne rien imbriquer dans un élément
           interactif. C'est la seule exception que ce module fait à la règle des
           composants Base*, celle que CardButton fait déjà pour le bouton
           illustré : la primitive s'écrit une fois, ici. -->
      <button
        type="button"
        aria-label="Suite du dialogue"
        class="absolute inset-0 z-30 cursor-pointer appearance-none border-0 bg-transparent outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/70"
        @click="advance"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
// Une scène de dialogue : un décor, un ou deux interlocuteurs, une boîte où le
// texte défile. Elle joue le dialogue qu'on lui donne et n'en connaît rien
// d'autre — aucun boss, aucune phase, aucun appel d'API : elle rend la main par
// `end`, et c'est l'écran appelant qui décide de la suite. C'est ce qui la rend
// jouable partout, du banc de design à l'introduction d'un boss.
//
// Elle ne se rembobine pas (voir useDialogue) : jouer un autre dialogue veut
// dire remonter le composant, `:key` dessus.
import type { Dialogue } from '~~/utils/dialogue'

const props = defineProps<{ dialogue: Dialogue }>()

const emit = defineEmits<{
  /** La dernière réplique est passée : l'écran appelant reprend la main. */
  end: []
}>()

// L'affiche, résolue ici plutôt que dans le template : le rétrécissement des
// deux formes de dialogue se lit mieux en TypeScript qu'en `v-if` imbriqués, et
// le template n'a plus qu'à poser des portraits.
const solo = computed(() => props.dialogue.center ?? null)
const pair = computed(() => (props.dialogue.center
  ? null
  : [
      { speaker: props.dialogue.left, place: 'left' as const },
      { speaker: props.dialogue.right, place: 'right' as const },
    ]))

const { speaker, place, shown, revealed, advance } = useDialogue(
  computed(() => props.dialogue),
  () => emit('end'),
)

// Entrée fait avancer comme le clic, par le même chemin que les écrans de jeu.
// Toujours prête : un dialogue affiché est un dialogue qui attend un geste.
// Quand c'est le bouton de la scène qui a le focus, `advancesOnEnter` lui rend
// la touche — il s'active déjà seul, sinon un appui avancerait de deux.
useAdvanceOnEnter(ref(true), advance)
</script>
