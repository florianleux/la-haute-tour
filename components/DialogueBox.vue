<template>
  <!-- Ce qui se dit. Sa forme suit celle de la scène (voir DialogueScene) :

       — en mobile, le haut de la carte. Pas de fond ni d'ombre à elle : la
         carte en porte déjà, et une boîte dans la boîte n'ajouterait qu'un
         cadre. Le texte se lit au-dessus des personnages, rien ne se recouvre.
       — en desktop (`sm:`), une boîte posée sur le bas de l'écran, par-dessus
         les portraits — le cadrage du genre, où le texte coupe les jambes des
         personnages.

       Les tailles sont en `cqw` de la carte en mobile, où la composition doit
       tenir d'un téléphone à l'autre ; en rem en desktop, où la scène occupe
       toute la fenêtre et où un `cqw` gonflerait le texte avec l'écran. -->
  <div
    class="relative z-20 flex flex-col gap-[2cqw] px-[5cqw] py-[4cqw] sm:absolute sm:bottom-[5%] sm:left-1/2 sm:block sm:w-[80%] sm:max-w-5xl sm:-translate-x-1/2 sm:rounded-3xl sm:bg-stone-100/95 sm:px-8 sm:py-6 sm:shadow-2xl sm:ring-1 sm:ring-black/10"
  >
    <!-- L'étiquette du nom, rangée du côté de celui qui parle : c'est ce qui
         dit lequel des deux portraits a la parole, sans avoir à lire le nom.
         En desktop elle passe à cheval sur le bord haut de la boîte, décalée
         de sa propre hauteur — `-translate-y-full` et non un décalage chiffré,
         qui se serait désaccordé au premier réglage de la taille du texte. -->
    <p
      class="rounded-xl bg-stone-800 px-[3cqw] py-[1.2cqw] text-[4cqw] font-bold text-stone-100 sm:absolute sm:top-0 sm:-translate-y-full sm:rounded-b-none sm:px-4 sm:py-1.5 sm:text-2xl sm:ring-1 sm:ring-black/10"
      :class="SIDES[place]"
    >
      {{ name }}
    </p>

    <!-- La hauteur est réservée d'avance, et figée : `h` et non `min-h`. Sans
         elle, la boîte grandirait au fil du défilé, sauterait à chaque réplique
         suivante, et en mobile la carte entière — dont la hauteur est celle de
         son contenu — bougerait avec elle.

         La réserve est comptée en lignes de texte (`lh`) et non en `cqw`
         calculés à la main : une taille de texte retouchée emporte la réserve
         avec elle au lieu de se désynchroniser en silence. Cinq lignes en
         mobile, quatre en desktop où la boîte est plus large : c'est ce que
         tient la plus longue réplique qu'on s'autorise.

         ponytail: au-delà, le texte déborde de la réserve au lieu de la pousser
         — c'est le signal qu'une réplique est trop longue pour la scène. Un
         découpage automatique en plusieurs répliques serait la suite, le jour
         où l'écriture en demande.

         Une réplique à choix fait exception : ses réponses se rangent dans la
         réserve, juste sous la question, et non sous la réserve entière. Le
         texte y perd sa hauteur figée, la réserve passe au cadre qui l'entoure
         — en `min-h`, pour que des réponses qui ne tiennent pas poussent la
         boîte plutôt que d'en sortir. La taille du texte est portée par ce
         cadre : les réponses la reprennent, et `lh` y vaut la même ligne. -->
    <div class="min-h-[5lh] text-[4cqw] leading-relaxed text-stone-800 sm:min-h-[4lh] sm:text-2xl">
      <p :class="choices ? '' : 'h-[5lh] sm:h-[4lh]'">
        {{ text }}
      </p>

      <!-- Les choix : une ligne par réponse, qu'on clique pour la dire — le
           geste des point & click. Même règle que l'invite, ils ne paraissent
           qu'une fois la question entièrement posée. -->
      <div v-if="choices && revealed" class="flex flex-col items-start">
        <BaseButton
          v-for="(choice, rank) in choices"
          :key="rank"
          variant="option"
          @click="emit('choose', rank)"
        >
          {{ choice }}
        </BaseButton>
      </div>
    </div>

    <!-- L'invite : le champ ne paraît qu'une fois la réplique sortie, sinon il
         demanderait de répondre à une question à moitié posée. Il prend le
         clavier en arrivant, et sa borne haute est celle du champ lui-même — la
         frappe s'arrête plutôt que d'annoncer une faute après coup. La borne
         basse, elle, retient le dialogue : voir `dialogueGesture`.

         Entrée répond depuis le champ : le raccourci de la scène
         (`useAdvanceOnEnter`) laisse la touche aux champs de saisie. -->
    <div v-if="prompt && revealed" class="flex items-end gap-2">
      <BaseInput
        v-model="answer"
        class="flex-1"
        autofocus
        clear
        :label="prompt.label"
        :maxlength="prompt.maxLength"
        @keydown.enter.prevent="emit('submit')"
      />
      <BaseButton variant="text" :disabled="awaiting" @click="emit('submit')">
        Répondre
      </BaseButton>
    </div>

    <!-- Le repère de suite, seul indice que le dialogue attend un geste. Il ne
         paraît qu'une fois la réplique entière sortie : avant, le geste sert à
         la révéler, pas à passer.

         Caché (`invisible`) et non retiré : en mobile il est dans le flux de la
         carte, et le retirer ferait monter puis redescendre toute la carte à
         chaque réplique. -->
    <span
      aria-hidden="true"
      class="self-end text-[3.4cqw] text-stone-500 sm:absolute sm:bottom-3 sm:right-6 sm:text-xl"
      :class="revealed && !awaiting ? 'animate-pulse' : 'invisible'"
    >▼</span>
  </div>
</template>

<script setup lang="ts">
// La boîte de dialogue : un nom, le texte qui sort caractère par caractère, et
// le repère qui dit qu'on peut passer. Elle ne sait rien du déroulé — ni quelle
// réplique, ni combien il en reste : on lui donne ce qu'il y a à lire, elle le
// met en page. C'est ce qui la laisse servir un dialogue de boss comme
// n'importe quel autre.
import type { DialogueChoices, DialoguePrompt, SpeakerPlace } from '~~/utils/dialogue'

// Les classes sont écrites en entier, jamais construites par concaténation :
// Tailwind ne voit que ce qui est littéral dans le source. Même table que
// DialoguePortrait, pour la même raison.
//
// Deux façons de ranger l'étiquette pour une seule intention : l'alignement
// dans la colonne en mobile, le bord de la boîte en desktop, où elle est en
// position absolue.
const SIDES: Record<SpeakerPlace, string> = {
  left: 'self-start sm:left-6',
  right: 'self-end sm:right-6',
  center: 'self-center sm:left-1/2 sm:-translate-x-1/2',
}

defineProps<{
  /** Qui parle. */
  name: string
  /** D'où il parle : l'étiquette se range de son côté. */
  place: SpeakerPlace
  /** Ce qui est sorti de sa réplique — pas la réplique entière. */
  text: string
  /** Elle est sortie en entier : le repère de suite s'allume. */
  revealed: boolean
  /** Ce que la réplique demande d'écrire, s'il y a lieu. */
  prompt: DialoguePrompt | null
  /** Les réponses que la réplique propose de cliquer, s'il y a lieu. */
  choices: DialogueChoices | null
  /**
   * L'invite n'a pas sa réponse, ou les choix attendent un clic : le repère de
   * suite reste éteint.
   */
  awaiting: boolean
}>()

/**
 * Ce que le joueur écrit. Tenu par le déroulé (voir useDialogue), pas par la
 * boîte : c'est lui qui décide quand le geste passe, et qui vide la saisie en
 * changeant de réplique.
 */
const answer = defineModel<string>('answer', { required: true })

const emit = defineEmits<{
  /** Le joueur valide sa saisie : à la scène de faire avancer le dialogue. */
  submit: []
  /** Le joueur clique le choix de ce rang. */
  choose: [number]
}>()
</script>
