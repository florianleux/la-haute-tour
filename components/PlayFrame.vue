<template>
  <!-- Le décor, fixe : il est ancré au viewport et non au document, sinon le
       moindre rebond de scroll le fait glisser sous le cadre. -->
  <div
    class="fixed inset-0 z-0 bg-cover bg-center"
    :class="[SKINS[skin].background, shade(null)]"
    :data-arriving="arriving || undefined"
  />

  <!-- Le coup reçu : le bord de l'écran rougit, le temps d'un éclair. Sous le
       Mimic, il rougit et reste rouge : toutes les vies sont parties. -->
  <div
    v-if="reaction && VIGNETTES[reaction]"
    class="pointer-events-none fixed inset-0 z-20"
    :class="VIGNETTES[reaction]"
  />

  <!-- Pendant que Michel parle (question d'essai), rien ne se clique : sa
       bulle, hors du cadre, est la seule à répondre. -->
  <div
    class="relative z-10 mx-auto w-full"
    :class="[SKINS[skin].wrapper, reaction && REACTIONS[reaction]]"
    :inert="shaded || undefined"
  >
    <!-- container-type (@container) fait de la largeur du cadre l'unité `cqw`
         de tout ce qu'il porte : le texte rétrécit avec l'illustration au lieu
         de rester en px et de se détacher de ses repères. bg-contain le laisse
         rétrécir entier. `group` sert au décalage clavier du panneau ci-dessous,
         et `data-arriving` à l'entrée des enfants, rubans compris : ils lisent
         l'attribut (`group-data-arriving:`) sans prop à faire descendre. -->
    <!-- Il monte un peu pendant le jugement d'une réponse, et retombe quand le
         verdict arrive (ou quand l'envoi échoue). En `!` comme le médaillon :
         la classe d'arrivée reste tant que le cadre est monté. -->
    <div
      class="group relative mx-auto w-full origin-bottom @container"
      :class="[SKINS[skin].frame, SKINS[skin].entrance, lift]"
      :data-arriving="arriving || undefined"
    >
      <!-- Les rubans, quand l'illustration en dessine (l'ascension oui, le
           parchemin du rattrapage non). Sous l'illustration : ils sortent de
           derrière elle. Dans un calque plein cadre : c'est lui que l'ombre
           de Michel assombrit, les rubans gardent leurs positions. -->
      <div
        class="pointer-events-none absolute inset-0"
        :class="shade('ribbons')"
      >
        <slot name="ribbons" />
      </div>

      <!-- L'illustration, rognée à son cadre seul (`art`) : les rubans qu'elle
           dessine aussi sont redessinés, mobiles, par StatsRibbons — sans le
           rognage, ils resteraient visibles à leur place pendant qu'ils
           sortent. -->
      <div
        class="pointer-events-none absolute inset-0 bg-contain bg-center bg-no-repeat"
        :class="[SKINS[skin].art, shade(null)]"
      />

      <!-- Même rôle des deux côtés, deux dessins. Son tremblement de jugement
           passe en `!` : un cadre arrivé garde sa classe d'arrivée tant qu'il
           est monté, et elle l'emporterait sinon. -->
      <PlayMedallion
        v-if="$slots.medallion"
        :ratio="SKINS[skin].medallionRatio"
        :ink="SKINS[skin].medallionInk"
        class="group-data-arriving:motion-safe:animate-medallion-drop [--enter-delay:0.3s]"
        :class="[SKINS[skin].medallion, motion && MOTIONS[motion].medallion, shade('timer')]"
      >
        <slot name="medallion" />
      </PlayMedallion>

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
        :class="[SKINS[skin].panel, motion && MOTIONS[motion].panel, shade('dispute')]"
      >
        <slot />
      </div>

      <!-- Le calque de l'ombre, plein cadre comme celui des rubans : un filtre
           sur une boîte sans position déplacerait le bouton, qui s'ancre au cadre. -->
      <div
        class="pointer-events-none absolute inset-0 *:pointer-events-auto"
        :class="shade(null)"
      >
        <slot name="action" />
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import type { LessonLine, PlayTarget } from '~~/utils/lessons'

// L'habillage du dernier cadre démonté, le temps du patch en cours. Chaque card
// monte son propre PlayFrame : passer de la question au verdict démonte l'un
// (onBeforeUnmount, synchrone) et monte l'autre dans le même patch. Un cadre
// qui monte juste après un cadre du même habillage continue la scène ; sinon,
// il arrive — chargement de page, retour d'attente (CooldownCard n'a pas de
// cadre, le minuteur a vidé la variable), passage au rattrapage et retour.
// Suppose que l'ancien cadre se démonte et le nouveau se monte dans le même
// patch synchrone : une card asynchrone, un <Suspense> ou une <Transition
// mode="out-in"> entre les deux ferait rejouer l'entrée à chaque écran.
// Côté serveur, rien ne se démonte : le premier rendu arrive des deux côtés.
let leaving: string | null = null

// Le cadre démonté était soulevé par le jugement d'une réponse : celui qui le
// remplace, le verdict, retombe à sa place au lieu d'y apparaître. Même
// passage de relais que `leaving`, dans le même patch.
let liftedOnLeave = false
</script>

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
  /** Le décor plein écran, derrière le cadre, et ce qu'il encaisse à l'arrivée. */
  background: string
  /** Gouttières et calage vertical du cadre dans la page. */
  wrapper: string
  /** Le format du cadre, mobile puis `sm:`. */
  frame: string
  /** L'illustration du cadre, rognée à lui seul quand elle dessine des rubans. */
  art: string
  /** L'arrivée du cadre (voir `leaving`), sur l'attribut `data-arriving`. */
  entrance: string
  /** Position, taille et dessin du médaillon. */
  medallion: string
  medallionRatio: string
  /**
   * Le centre du disque, où se pose le chiffre, et la taille du chiffre, en
   * cqw du médaillon — les deux mesurés sur l'image.
   */
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
    frame: 'aspect-428/855 sm:aspect-1980/775',
    // Le cadre seul : en mobile, tout ce qui est au-dessus du bas du cadre
    // (609 px sur 855) ; en desktop, entre ses deux montants (353 et 1627 px
    // sur 1980). Mesuré sur les images.
    art: 'bg-[url(/images/mobile-play-card.webp)] [clip-path:inset(0_0_28.7%_0)] sm:bg-[url(/images/game-card.webp)] sm:[clip-path:inset(0_17.8%)]',
    entrance: 'data-arriving:motion-safe:animate-drop-in',
    medallion: 'top-[7.5%] w-[45.9%] bg-[url(/images/game-timer.webp)] sm:top-[-6.8%] sm:w-[22.95%]',
    medallionRatio: '616 / 357',
    medallionInk: 'top-[66%] text-[12cqw]',
    panel: 'left-[8%] top-[18%] h-[40%] w-[84%] max-sm:group-has-[#answer:focus]:top-[14%] max-sm:group-has-[#answer:focus]:h-[34%] sm:left-[24%] sm:top-[18%] sm:h-[62%] sm:w-[52%]',
  },
  // Le rattrapage : un parchemin cloué entre quatre piquets, sans ruban à
  // contourner, donc un panneau qui prend presque toute la feuille.
  //
  // Le médaillon y est plus large que celui de l'ascension pour un disque de
  // même taille : son disque n'occupe que 30,5% de la hauteur du dessin contre
  // 40,3% pour l'autre, d'où un dessin 1,33 fois plus grand. Le chiffre, lui,
  // porte 20 % de plus que celui de l'ascension (11,5 cqw au lieu des 9,5 qui
  // l'égalaient), réglé à l'œil comme la position : un peu au-dessus du bord
  // haut du parchemin.
  recovery: {
    // Il tremble à l'impact du parchemin, 33 % de `animate-plant`.
    background: 'bg-[url(/images/blurry-cooldown-bg.webp)] data-arriving:motion-safe:animate-jolt [--enter-delay:0.3s]',
    // Plus étroit que le `max-w-4xl` de l'ascension, et mesuré pour ça : les
    // deux illustrations n'ont pas la même proportion de page utile. Le cadre
    // de la tour laisse 52% de sa largeur au texte, le parchemin 82% — à
    // largeur d'image égale, le rattrapage offrait une page 76% plus grande.
    // C'est la page écrite qui doit faire la même taille des deux côtés, pas le
    // fichier image, d'où une valeur qui ne tombe pas sur un palier Tailwind.
    wrapper: '-mt-16 max-w-[40rem] py-8 sm:-mt-40 sm:py-16',
    frame: 'aspect-510/522 sm:aspect-740/501',
    art: 'bg-[url(/images/recovery-modal-mobile.webp)] sm:bg-[url(/images/recovery-modal-desktop.webp)]',
    entrance: 'data-arriving:motion-safe:animate-plant',
    medallion: 'top-[-15.6%] w-[57.9%] bg-[url(/images/recovery-modal-timer.webp)] sm:top-[4.8%] sm:w-[35%]',
    medallionRatio: '346 / 210',
    medallionInk: 'top-[75%] text-[11.5cqw]',
    // Aussi large, en pixels, que celui de l'ascension (84% de 327 px en
    // mobile, 466 px en desktop sur un cadre de 640) : le texte s'y compte en
    // cqw du panneau, et c'est ce qui donne à la question et au champ la même
    // taille sur les deux écrans. Il part du bas du médaillon, où se pose le
    // décompte du tirage.
    panel: 'left-[8%] top-[9%] h-[75%] w-[84%] max-sm:group-has-[#answer:focus]:top-[9%] max-sm:group-has-[#answer:focus]:h-[61%] sm:left-[13.6%] sm:top-[21%] sm:h-[61%] sm:w-[72.8%]',
  },
}

const props = defineProps<{
  skin: PlaySkin
  /**
   * Le cadre entier, rubans compris, réagit au verdict : `hit` sur une vie
   * perdue (il encaisse un coup et le bord de l'écran rougit), `hop` sur une
   * bonne réponse (il fait un petit saut), `mauled` sous le Mimic (le même
   * coup au moment où il frappe, et le bord reste rouge), `quake` à
   * l'ouverture d'un coffre (il tremble avec lui), `pop` quand le coffre
   * s'ouvre sur un trésor (il gonfle et rebondit). Sur l'enveloppe et
   * non sur le cadre, dont l'`animation` d'arrivée écraserait celle-ci.
   */
  reaction?: 'hit' | 'hop' | 'mauled' | 'quake' | 'pop'
  /**
   * L'attente d'un geste, jouée pendant que la requête part : `judging` sur
   * Valider (l'encre remonte, le médaillon tremble jusqu'au verdict), `leaving`
   * sur Suivante (le verdict glisse et s'efface). Retirée, la carte revient
   * telle qu'avant le clic — c'est ce qu'on veut sur un envoi refusé.
   * Voir specs/ecrans.md.
   */
  motion?: 'judging' | 'leaving'
  /**
   * La réplique de Michel, à la question d'essai : ce qu'elle éclaire échappe
   * à l'ombre, le reste s'assombrit. Le panneau s'éclaire avec « Contester »,
   * qu'il porte : c'est VerdictLines qui assombrit le reste du verdict.
   * Voir specs/spec.md (glossaire, « Éclairage »).
   */
  lesson?: LessonLine | null
}>()

const shaded = computed(() => lessonDims(props.lesson))

/** L'ombre d'une partie du cadre, levée seulement quand la réplique la montre. Null : le reste du cadre. */
function shade(part: PlayTarget | null): string {
  return (part ? spotlightOn(props.lesson, part).dimmed : shaded.value) ? LESSON_SHADE : ''
}

// Chaque attente décrite d'un seul endroit, panneau et médaillon ensemble.
const MOTIONS = {
  judging: { panel: 'motion-safe:animate-ink-lift', medallion: 'motion-safe:animate-judge-quiver!' },
  leaving: { panel: 'motion-safe:animate-verdict-leave', medallion: '' },
} as const

const REACTIONS = {
  hit: 'motion-safe:animate-hit',
  hop: 'motion-safe:animate-hop',
  mauled: 'motion-safe:animate-mauled',
  quake: 'motion-safe:animate-quake',
  pop: 'motion-safe:animate-pop',
} as const

// Le bord rouge de chaque coup : un éclair sur `hit`, plus dense et qui reste
// en battant sous le Mimic.
const VIGNETTES: Partial<Record<keyof typeof REACTIONS, string>> = {
  hit: HIT_VIGNETTE,
  mauled: 'bg-[radial-gradient(ellipse_at_center,transparent_20%,rgb(220_38_38/0.5)_55%,rgb(127_29_29/0.95)_100%)] motion-safe:animate-vignette-hold',
}

// L'arrivée ne se joue qu'une fois : l'attribut tombe quand elle est finie.
// Le rattrapage garde son cadre de la question au verdict ; sans ça, la fin du
// jugement rendait au médaillon (et au cadre) leur animation d'arrivée, qui
// repartait de zéro — le chrono disparaissait, puis retombait.
// ponytail: durée fixe, plus longue que toutes les entrées (la plus longue,
// le bouton, 1,35 s) ; à lire sur animationend si une entrée s'allonge.
const ARRIVAL_MS = 2000
const arriving = ref(leaving !== props.skin)

onMounted(() => {
  if (arriving.value) {
    setTimeout(() => {
      arriving.value = false
    }, ARRIVAL_MS)
  }
})

// Retombe à l'arrivée s'il prend la suite d'un cadre soulevé (la question
// d'ascension remplacée par son verdict), ou sur place quand le jugement
// s'achève sans démontage (le rattrapage garde son cadre, et un envoi refusé
// laisse la question).
const settling = ref(liftedOnLeave)

watch(() => props.motion, (now, before) => {
  settling.value = before === 'judging' && now !== 'judging'
})

const lift = computed(() => {
  if (props.motion === 'judging') {
    return 'motion-safe:animate-frame-lift!'
  }
  return settling.value ? 'motion-safe:animate-frame-settle!' : ''
})

onBeforeUnmount(() => {
  leaving = props.skin
  liftedOnLeave = props.motion === 'judging'
  setTimeout(() => {
    leaving = null
    liftedOnLeave = false
  })
})
</script>
