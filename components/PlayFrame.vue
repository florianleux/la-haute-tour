<template>
  <!-- Le décor, fixe : il est ancré au viewport et non au document, sinon le
       moindre rebond de scroll le fait glisser sous le cadre. -->
  <div
    class="fixed inset-0 z-0 bg-cover bg-center"
    :class="SKINS[skin].background"
  />

  <div
    class="relative z-10 mx-auto w-full"
    :class="SKINS[skin].wrapper"
  >
    <!-- container-type (@container) fait de la largeur du cadre l'unité `cqw`
         de tout ce qu'il porte : le texte rétrécit avec l'illustration au lieu
         de rester en px et de se détacher de ses repères. bg-contain le laisse
         rétrécir entier. `group` sert au décalage clavier du panneau ci-dessous. -->
    <div
      class="group relative mx-auto w-full @container bg-contain bg-center bg-no-repeat"
      :class="SKINS[skin].frame"
    >
      <!-- Les rubans, quand l'illustration en dessine (l'ascension oui, le
           parchemin du rattrapage non). -->
      <slot name="ribbons" />

      <!-- Le médaillon, à cheval sur le bord haut : chrono pendant la question,
           juste/faux sur le verdict. Même rôle des deux côtés, deux dessins. -->
      <div
        v-if="$slots.medallion"
        class="absolute left-1/2 z-20 -translate-x-1/2 -translate-y-1/2 @container bg-contain bg-center bg-no-repeat"
        :class="SKINS[skin].medallion"
        :style="{ aspectRatio: SKINS[skin].medallionRatio }"
      >
        <!-- Le chiffre au centre du disque, dont la hauteur n'est pas la même
             d'un dessin à l'autre : mesurée sur l'image, pas estimée. `leading-none`
             pour que la boîte de ligne colle aux chiffres — sans lui, l'espace
             réservé aux jambages la fait porter haut dans le disque. -->
        <div
          class="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 leading-none"
          :class="SKINS[skin].medallionInk"
        >
          <slot name="medallion" />
        </div>
      </div>

      <!-- Le panneau où tout le texte s'empile. Une seule façon d'empiler pour
           les deux habillages : les lignes se suivent dans l'ordre du template,
           centrées, et c'est la place disponible qui change d'un cadre à
           l'autre — pas la manière de la remplir. Il ne défile pas : une page
           clouée entre deux piquets ne défile pas, donc les tailles (toutes en
           cqw, voir PlayText) sont réglées pour que le pire cas tienne.

           Sur mobile, le clavier virtuel rétrécit la fenêtre visible et le
           navigateur remonte le champ : `group-has-[#answer:focus]` recale et
           resserre le panneau tant que le champ a le focus — pas de JS, pas de
           mesure de hauteur de clavier, juste l'état du focus. -->
      <div
        class="absolute flex flex-col items-center justify-center gap-[0.7cqw] overflow-hidden @container text-center transition-all"
        :class="SKINS[skin].panel"
      >
        <slot />
      </div>

      <slot name="action" />
    </div>
  </div>
</template>

<script setup lang="ts">
// Le cadre de jeu : décor, illustration, médaillon, panneau de texte et
// emplacement du bouton. Partagé par l'ascension (QuestionCard, ResultCard) et
// le rattrapage (RecoveryCard), qui ne se distinguent plus que par leurs
// images et la place qu'elles laissent — le reste, y compris la façon
// d'empiler le contenu, est écrit ici une fois.
//
// Les tailles de texte vivent dans PlayText, pour la même raison : recopiées
// carte par carte, elles divergeaient au premier réglage.
//
// Chaque habillage est décrit d'un seul endroit — décor, cadre, médaillon,
// panneau, ancre du bouton ensemble : ces cinq-là changent toujours en même
// temps, et les éparpiller obligeait à lire cinq tables pour savoir de quoi un
// écran a l'air. Les classes sont écrites en entier (jamais construites par
// concaténation) : Tailwind ne voit que ce qui est littéral dans le source.
type PlaySkin = 'ascent' | 'recovery'

interface Skin {
  /** Le décor plein écran, derrière le cadre. */
  background: string
  /** Gouttières et calage vertical du cadre dans la page. */
  wrapper: string
  /** L'illustration du cadre et son format, mobile puis `sm:`. */
  frame: string
  /** Position, taille et dessin du médaillon. */
  medallion: string
  medallionRatio: string
  /** Le centre du disque, où se pose le chiffre — mesuré sur l'image. */
  medallionInk: string
  /** La boîte où le texte s'empile, et son repli quand le clavier s'ouvre. */
  panel: string
}

const SKINS: Record<PlaySkin, Skin> = {
  // L'ascension : le cadre paysage de la tour, rubans dessinés sur les côtés en
  // desktop et sous le cadre en mobile — d'où un panneau plus étroit à droite et
  // à gauche là, plus court en bas ici.
  ascent: {
    background: 'bg-[url(/images/play-bg.webp)]',
    wrapper: '-mt-16 max-w-4xl py-8 sm:-mt-40 sm:py-16',
    frame: 'aspect-428/855 bg-[url(/images/mobile-play-card.webp)] sm:aspect-1980/775 sm:bg-[url(/images/game-card.webp)]',
    medallion: 'top-[7%] w-[60%] bg-[url(/images/game-timer.webp)] sm:top-[-8%] sm:w-[30%]',
    medallionRatio: '616 / 357',
    medallionInk: 'top-[66%]',
    panel: 'left-[8%] top-[18%] h-[40%] w-[84%] max-sm:group-has-[#answer:focus]:top-[14%] max-sm:group-has-[#answer:focus]:h-[34%] sm:left-[24%] sm:top-[18%] sm:h-[62%] sm:w-[52%]',
  },
  // Le rattrapage : un parchemin cloué entre quatre piquets, sans ruban à
  // contourner, donc un panneau qui prend presque toute la feuille.
  //
  // Le médaillon y est plus large que celui de l'ascension sans lire plus gros :
  // son disque n'occupe que 30,5% de la hauteur du dessin contre 40,3% pour
  // l'autre. La largeur ci-dessous est en deçà de ce qu'il faudrait pour deux
  // disques strictement égaux — assumé, la taille au-dessus écrasait le haut du
  // parchemin. Elle le laisse reposer sur le bord de la feuille plutôt que
  // flotter au-dessus.
  recovery: {
    background: 'bg-[url(/images/blurry-cooldown-bg.webp)]',
    // Plus étroit que le `max-w-4xl` de l'ascension, et mesuré pour ça : les
    // deux illustrations n'ont pas la même proportion de page utile. Le cadre
    // de la tour laisse 52% de sa largeur au texte, le parchemin 82% — à
    // largeur d'image égale, le rattrapage offrait une page 76% plus grande.
    // C'est la page écrite qui doit faire la même taille des deux côtés, pas le
    // fichier image, d'où une valeur qui ne tombe pas sur un palier Tailwind.
    wrapper: '-mt-16 max-w-[40rem] py-8 sm:-mt-40 sm:py-16',
    frame: 'aspect-510/522 bg-[url(/images/recovery-modal-mobile.webp)] sm:aspect-740/501 sm:bg-[url(/images/recovery-modal-desktop.webp)]',
    medallion: 'top-[4%] w-[58%] bg-[url(/images/recovery-modal-timer.webp)] sm:top-[9%] sm:w-[40%]',
    medallionRatio: '346 / 210',
    medallionInk: 'top-[72%]',
    panel: 'left-[10%] top-[22%] h-[62%] w-[80%] max-sm:group-has-[#answer:focus]:top-[18%] max-sm:group-has-[#answer:focus]:h-[52%] sm:left-[9%] sm:top-[27%] sm:h-[55%] sm:w-[82%]',
  },
}

defineProps<{ skin: PlaySkin }>()
</script>
