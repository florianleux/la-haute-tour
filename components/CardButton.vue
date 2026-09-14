<template>
  <!-- À cheval sur le bord bas du cadre. Le positionnement (translate de calage)
       vit sur ce conteneur ; le hover (scale) vit sur le bouton lui-même, pour
       ne pas composer les deux transforms — sinon le texte dérive légèrement
       de son repère au survol. -->
  <div
    class="absolute z-20 -translate-x-1/2 translate-y-1/2"
    :class="[ANCHORS[anchor].position, ANCHORS[anchor].width]"
    :style="{ aspectRatio: face === 'plank' ? '328 / 95' : '634 / 175' }"
  >
    <button
      type="button"
      :disabled="disabled || loading"
      :aria-busy="loading"
      class="relative flex h-full w-full appearance-none items-center justify-center border-0 bg-contain bg-center bg-no-repeat font-semibold uppercase leading-none tracking-wider outline-none transition-[transform,filter] ease-out will-change-transform hover:scale-110 hover:brightness-110 active:scale-105 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:brightness-100 enabled:cursor-pointer"
      :class="[FACES[face], ANCHORS[anchor].text]"
      @click="$emit('click')"
    >
      <!-- Le loader prend la place du libellé sans changer la largeur du bouton,
           comme l'exige specs/ecrans.md — `invisible` garde la place du texte
           plutôt que de la reprendre. Même mécanique que BaseButton, et
           BaseSpinner hérite de la couleur par `border-current`, donc il suit
           l'encre du médaillon comme celle de la planche. -->
      <span
        class="contents"
        :class="loading ? 'invisible' : ''"
      >
        {{ label }}
      </span>
      <BaseSpinner
        v-if="loading"
        class="absolute inset-0 justify-center"
      />
    </button>
  </div>
</template>

<script setup lang="ts">
// Le bouton illustré du bas de carte : « Valider » sur QuestionCard, l'action
// suivante sur ResultCard, « Commencer » sur le poster de l'attente — même
// mécanique de hover partout, seuls le libellé, l'habillage et le calage changent.
//
// `anchor` dit où le bouton se pose, `face` de quoi il a l'air : deux choses
// distinctes, un même poster pouvant demander l'une sans l'autre.
//
// Chaque ancre est décrite d'un seul endroit, position, largeur et taille de
// texte ensemble : ces trois-là changent toujours en même temps, et les répartir
// entre deux `:class` obligeait à lire deux tables pour savoir ce que valait une
// ancre. Elles vont par trois parce que le poster est presque carré là où les
// cadres de jeu sont en paysage — une largeur en pourcentage n'y couvre pas la
// même chose, donc le texte non plus.
//
// - 'image-bottom' : cadre large (desktop partout, et ChestCard qui n'a pas de
//   variante mobile), le bas du bouton coïncide avec le bas de l'image.
// - 'card-bottom' : QuestionCard/ResultCard en mobile, où le cadre portrait
//   laisse les rubans dépasser sous le bas réel du cadre — le bouton se cale sur
//   ce bord-là, pas sur celui de l'image.
// - 'poster' : WaitCard, où le bouton se pose sur le parchemin. `left-[54%]` et
//   non `left-1/2` : l'illustration n'est pas symétrique (bannière débordant à
//   droite, corde pendant à gauche), si bien que le parchemin y est centré sur
//   54%. Mesuré, pas estimé — le corps de la feuille va de x=182 à x=807 sur 918.
// - 'modal' : RecoveryCard, où le bouton se pose à cheval sur le bord bas du
//   parchemin. Il tombe plus haut que 'image-bottom' parce que l'illustration
//   garde du bois sous la feuille, que le bouton n'a pas à recouvrir.
//
// `face` choisit l'illustration : le médaillon de parchemin par défaut, ou la
// planche clouée du camp — bois sombre, donc texte crème plutôt qu'ambre, et pas
// de `pb-2` puisqu'elle est symétrique là où le médaillon a une lèvre basse.
type Anchor = 'image-bottom' | 'card-bottom' | 'poster' | 'modal'
type Face = 'medallion' | 'plank'

const ANCHORS: Record<Anchor, { position: string, width: string, text: string }> = {
  'image-bottom': {
    position: 'bottom-0 left-1/2',
    width: 'w-[65%] sm:w-[32%]',
    text: 'text-[6.6cqw] sm:text-[3.3cqw]',
  },
  'card-bottom': {
    position: 'top-[62%] left-1/2 sm:top-[76%] sm:bottom-0',
    width: 'w-[65%] sm:w-[32%]',
    text: 'text-[6.6cqw] sm:text-[3.3cqw]',
  },
  'poster': {
    position: 'top-[63%] left-[54%]',
    width: 'w-[52%] sm:w-[34%]',
    text: 'text-[4cqw] sm:text-[3cqw]',
  },
  'modal': {
    // `translate-y-1/2` descend le bouton d'une demi-hauteur APRÈS le `top` :
    // son centre tombe donc à `top` + une hauteur entière, pas à `top`. Ces
    // valeurs sont le bord bas du parchemin — 91,4% en mobile, 89,2% en desktop,
    // mesurés sous la largeur du bouton — moins la hauteur du bouton (14,6% du
    // cadre), pour qu'il tombe à cheval sur ce bord et non entièrement dessous.
    position: 'top-[77%] left-1/2 sm:top-[75%]',
    width: 'w-[52%] sm:w-[34%]',
    text: 'text-[4cqw] sm:text-[2.6cqw]',
  },
}

const FACES: Record<Face, string> = {
  medallion: 'bg-[url(/images/submit-button.webp)] pb-2 text-amber-600',
  plank: 'bg-[url(/images/recovery-modal-button.webp)] text-amber-50 drop-shadow-[0_1px_1px_rgba(0,0,0,0.45)]',
}

withDefaults(defineProps<{
  label: string
  disabled?: boolean
  loading?: boolean
  anchor?: Anchor
  face?: Face
}>(), {
  disabled: false,
  loading: false,
  anchor: 'image-bottom',
  face: 'medallion',
})

defineEmits<{ click: [] }>()
</script>
