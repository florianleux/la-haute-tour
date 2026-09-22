<template>
  <!-- Le décor, fixe : ancré au viewport et non au document, sinon le moindre
       rebond de scroll le fait glisser sous la scène. Même ancrage que
       PlayFrame, pour la même raison.

       Cadré par le bas en mobile : l'écran y est plus haut que large, et un
       décor centré n'y montrerait qu'un ciel vide au-dessus des personnages.
       En desktop, la largeur manque plutôt que la hauteur, et le centre
       reprend. -->
  <div
    class="fixed inset-0 z-0 bg-cover bg-bottom sm:bg-center"
    :style="{ backgroundImage: `url('${dialogue.background}')` }"
  />

  <!-- Ancré au viewport comme le décor, et non posé dans le flux de la page :
       ça sort aussi la scène du `p-6` de la mise en page. -->
  <div class="fixed inset-0 z-10 overflow-hidden">
    <!-- La scène. Elle change de nature avec la forme de l'écran :

         — en mobile, une carte posée sur le décor. L'écran y est trop étroit
           pour que deux personnages et un texte se recouvrent sans se gêner :
           la carte se lit de haut en bas, la réplique d'abord, les personnages
           debout sur son bord bas ensuite.
         — en desktop (`sm:`), tout l'écran. La largeur y suffit, et les
           personnages retrouvent les bords de la fenêtre.

         `@container` dans les deux cas : c'est lui qui donne à la carte son
         unité `cqw`, si bien que sa composition tient à toute largeur d'écran
         au lieu de se régler téléphone par téléphone. -->
    <div
      class="absolute inset-x-[3%] top-1/2 -translate-y-1/2 overflow-hidden rounded-3xl bg-stone-100/95 shadow-2xl ring-1 ring-black/10 @container sm:inset-0 sm:translate-y-0 sm:rounded-none sm:bg-transparent sm:shadow-none sm:ring-0"
    >
      <!-- Les personnages : pieds sur le bord bas de la carte en mobile, sur
           celui de la fenêtre en desktop — c'est le même `bottom-0`, la scène
           ayant changé de taille sous eux. -->
      <DialogueBox
        :name="speaker.name"
        :place="place"
        :text="shown"
        :revealed="revealed"
      />

      <!-- La rangée des personnages, sous la réplique en mobile. `sm:contents`
           la fait disparaître en desktop : les portraits y reprennent leur
           ancrage absolu sur la scène, sans qu'un cadre intermédiaire s'y
           interpose. -->
      <div class="flex items-end justify-center gap-[4cqw] sm:contents">
        <DialoguePortrait
          v-for="member in lineup"
          :key="member.place"
          :speaker="member.speaker"
          :place="member.place"
          :speaking="place === member.place"
        />
      </div>
    </div>

    <!-- Tout l'écran fait bouton, carte comprise : c'est le geste du genre, et
         il évite au joueur d'avoir une cible à viser. -->
    <BaseSurfaceButton
      label="Suite du dialogue"
      @click="advance"
    />
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
