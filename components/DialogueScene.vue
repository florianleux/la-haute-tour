<template>
  <!-- Le décor, fixe : ancré au viewport et non au document, sinon le moindre
       rebond de scroll le fait glisser sous la scène. Même ancrage que
       PlayFrame, pour la même raison.

       Cadré par le bas en mobile : l'écran y est plus haut que large, et un
       décor centré n'y montrerait qu'un ciel vide au-dessus des personnages.
       En desktop, la largeur manque plutôt que la hauteur, et le centre
       reprend. -->
  <div
    class="fixed inset-0 z-0 bg-cover bg-bottom wide:bg-center"
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
         — en desktop (`wide:`), tout l'écran. La largeur y suffit, et les
           personnages retrouvent les bords de la fenêtre.

         `@container` dans les deux cas : c'est lui qui donne à la carte son
         unité `cqw`, si bien que sa composition tient à toute largeur d'écran
         au lieu de se régler téléphone par téléphone. -->
    <div
      class="absolute inset-x-[3%] top-1/2 -translate-y-1/2 overflow-hidden rounded-3xl bg-stone-100/95 shadow-2xl ring-1 ring-black/10 @container wide:inset-0 wide:translate-y-0 wide:rounded-none wide:bg-transparent wide:shadow-none wide:ring-0"
    >
      <!-- Les personnages : pieds sur le bord bas de la carte en mobile, sur
           celui de la fenêtre en desktop — c'est le même `bottom-0`, la scène
           ayant changé de taille sous eux. -->
      <DialogueBox
        v-model:answer="answer"
        :name="speaker.name"
        :color="speaker.color"
        :choices-color="answerer?.color"
        :place="place"
        :text="shown"
        :revealed="revealed"
        :prompt="prompt"
        :choices="choices"
        :awaiting="awaiting"
        @submit="advance"
        @choose="choose"
      />

      <!-- La rangée des personnages, sous la réplique en mobile. `wide:contents`
           la fait disparaître en desktop : les portraits y reprennent leur
           ancrage absolu sur la scène, sans qu'un cadre intermédiaire s'y
           interpose. -->
      <div class="flex items-end justify-center gap-[4cqw] wide:contents">
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
         il évite au joueur d'avoir une cible à viser.

         Retiré pendant qu'une invite ou des choix attendent : il recouvrirait
         le champ ou les réponses, et aucun z-index de la boîte n'y changerait
         rien — la carte porte un `transform`, qui enferme la boîte dans son
         propre empilement. On répond alors par Entrée ou « Répondre », ou en
         cliquant un choix — un choix seul se prend aussi à Entrée ou aux
         flèches. -->
    <BaseSurfaceButton
      v-if="!((prompt || choices) && revealed)"
      label="Suite du dialogue"
      @click="advance"
    />
  </div>
</template>

<script setup lang="ts">
// Une scène de dialogue : un décor, un ou deux interlocuteurs, une boîte où le
// texte défile. Elle joue le dialogue qu'on lui donne et n'en connaît rien
// d'autre — aucun boss, aucune phase, aucun appel d'API : elle rend la main par
// `end`, ce qu'une invite a reçu par `answer` et le rang du choix cliqué par
// `choose`, à charge de l'écran appelant d'en faire quelque chose. C'est ce qui
// la rend jouable partout, du banc de design à l'introduction d'un boss.
//
// Lui servir un autre dialogue le reprend à sa première réplique (voir
// useDialogue) : aucun `:key` à poser dessus.
import type { Dialogue } from '~~/utils/dialogue'
import { DIALOGUE_KEYS } from '~~/utils/keyboard'

const props = defineProps<{ dialogue: Dialogue }>()

const emit = defineEmits<{
  /** La dernière réplique est passée : l'écran appelant reprend la main. */
  end: []
  /** Une invite a reçu sa réponse : voici ce que le joueur a écrit. */
  answer: [string]
  /** Un choix a été cliqué : voici son rang. */
  choose: [number]
}>()

const {
  lineup, speaker, place, shown, revealed, prompt, answer, choices, awaiting, advance, choose,
} = useDialogue(
  computed(() => props.dialogue),
  {
    onEnd: () => emit('end'),
    onAnswer: written => emit('answer', written),
    onChoose: rank => emit('choose', rank),
  },
)

// Les choix sont la réponse de l'autre : celui qui ne pose pas la question. Seul
// au milieu de la scène, personne ne répond en couleur.
const answerer = computed(() => lineup.value.find(member => member.place !== place.value)?.speaker)

// Entrée fait avancer comme le clic, par le même chemin que les écrans de jeu,
// et les flèches bas et droite aussi : on lit un dialogue comme on tourne des
// pages. Sans condition : un dialogue affiché est un dialogue qui attend un
// geste. Quand c'est le bouton de la scène qui a le focus, `advancesOnEnter`
// lui rend Entrée — il s'active déjà seul, sinon un appui avancerait de deux.
useAdvanceOnEnter(advance, true, DIALOGUE_KEYS)
</script>
