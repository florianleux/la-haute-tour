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
      <DialoguePortrait
        v-for="member in lineup"
        :key="member.place"
        :speaker="member.speaker"
        :place="member.place"
        :speaking="place === member.place"
      />

      <DialogueBox
        :name="speaker.name"
        :text="shown"
        :revealed="revealed"
      />

      <!-- Toute la scène fait bouton : c'est le geste du genre, et il évite au
           joueur d'avoir une cible à viser. -->
      <BaseSurfaceButton
        label="Suite du dialogue"
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
// Lui servir un autre dialogue le reprend à sa première réplique (voir
// useDialogue) : aucun `:key` à poser dessus.
import type { Dialogue } from '~~/utils/dialogue'

const props = defineProps<{ dialogue: Dialogue }>()

const emit = defineEmits<{
  /** La dernière réplique est passée : l'écran appelant reprend la main. */
  end: []
}>()

const { lineup, speaker, place, shown, revealed, advance } = useDialogue(
  computed(() => props.dialogue),
  { onEnd: () => emit('end') },
)

// Entrée fait avancer comme le clic, par le même chemin que les écrans de jeu.
// Sans condition : un dialogue affiché est un dialogue qui attend un geste.
// Quand c'est le bouton de la scène qui a le focus, `advancesOnEnter` lui rend
// la touche — il s'active déjà seul, sinon un appui avancerait de deux.
useAdvanceOnEnter(advance)
</script>
