<template>
  <div class="fixed inset-0 z-0 bg-[url(/images/cooldown-bg.webp)] bg-cover bg-center" />

  <!-- Les objets du camp, posés sur le décor. Chaque image est recadrée depuis
       un calque 1920×1080 aligné sur cooldown-bg.webp, et replacée à ses
       coordonnées d'origine en % d'une boîte 16:9 : COVER (la bannière) reproduit
       le `bg-cover bg-center` du décor, GROUND (la corde et le sol) reste calée
       sur la hauteur de la fenêtre. Voir ces deux constantes plus bas.

       Deux profondeurs : la corde et la bannière passent derrière le poster,
       ce qui est posé au sol devant — comme sur l'illustration. Une boîte par
       couche, parce qu'un `fixed` crée son propre contexte d'empilement : un
       z-index posé à l'intérieur ne passerait pas le poster.

       Sur un écran étroit, le cover rogne les côtés du décor, et les objets
       des bords avec lui : c'est le prix d'un ancrage au décor. -->
  <div
    v-for="(layer, index) in layers"
    :key="index"
    class="pointer-events-none fixed inset-0 @container-size"
    :class="layer.depth"
  >
    <div
      class="absolute left-1/2 aspect-video -translate-x-1/2"
      :class="layer.box"
    >
      <template
        v-for="prop in layer.items"
        :key="prop.src"
      >
        <NuxtLink
          v-if="prop.to"
          :to="prop.to"
          :aria-label="prop.label"
          class="pointer-events-auto absolute focus-visible:outline-2 focus-visible:outline-white/70"
          :class="[prop.place, layer.origin, HOVER]"
        >
          <img
            :src="prop.src"
            alt=""
            class="w-full"
          >
          <SparkleField
            :sparks="CAMP_SPARKS"
            class="opacity-0 transition-opacity duration-200 group-hover:opacity-100"
          />
        </NuxtLink>
        <div
          v-else
          class="absolute"
          :class="[prop.place, prop.advance && ['pointer-events-auto', layer.origin, HOVER]]"
        >
          <img
            :src="prop.src"
            alt=""
            class="w-full"
          >
          <SparkleField
            v-if="prop.advance"
            :sparks="CAMP_SPARKS"
            class="opacity-0 transition-opacity duration-200 group-hover:opacity-100"
          />
          <BaseSurfaceButton
            v-if="prop.advance"
            :label="action?.label ?? ''"
            @click="advancing || $emit('advance')"
          />
        </div>
      </template>
    </div>
  </div>

  <!-- Le poster est presque carré (918×980) là où le cadre de l'ascension est en
       paysage : le contraindre par la largeur seule le ferait déborder en
       hauteur dès que la fenêtre est large et basse. La largeur prend donc le
       plus petit de « toute la place disponible » et « ce qui tient dans la
       hauteur restante », et l'aspect-ratio en déduit la hauteur — le poster
       reste entier à toutes les tailles, sans JS ni mesure. `svh` plutôt que
       `vh` pour la barre d'adresse mobile. container-type (@container) fait de
       la largeur du poster l'unité `cqw` de son contenu, comme le cadre de
       QuestionCard : le texte doit rétrécir avec le parchemin, pas rester fixe
       quand il se redimensionne.

       `fixed`, comme le décor, et pour la même raison qu'eux deux : un élément
       `absolute` est ancré au document, un `fixed` au viewport. Les mélanger
       faisait de la parallaxe — au moindre rebond de scroll, même sans barre, le
       poster glissait sur un décor qui, lui, ne bougeait pas. Ancrés au même
       repère, ils ne peuvent plus se désolidariser. Hors flux également : le
       poster n'a plus de hauteur dans la page, donc il ne peut plus la faire
       déborder.

       Une conséquence de `fixed` : les pourcentages se mesurent sur le viewport
       et non plus sur le <main>, dont le `p-6` ne s'applique donc plus. Les 3rem
       de gouttière et le 1.5rem sous le poster sont repris explicitement ici pour
       garder le cadrage réglé juste avant.

       Ancré par le bas, pas centré. Le poster est planté dans le sol : ses
       piquets reposent sur des pierres, qui doivent tomber dans l'herbe du
       décor. Centré verticalement il s'en décollait — la moitié haute du décor
       étant du ciel, toute hauteur gagnée le soulevait en l'air. L'herbe occupe
       les ~15% inférieurs de cooldown-bg.webp (au-delà de 85%, le bleu s'effondre
       quand rouge et vert restent hauts : c'est le jaune-vert du sol), et
       `bg-cover` garde toujours ce bas d'image en bas de fenêtre — un ancrage à
       4svh du bord y pose donc les pierres quel que soit le format d'écran, assez
       haut pour qu'elles mordent dans l'herbe sans raser le bord.
       La hauteur disponible retranche cet ancrage et le `p-6` du gabarit, contre le
       bord intérieur duquel le poster se mesure. -->
  <div
    class="fixed bottom-[calc(4svh+1.5rem)] left-1/2 z-10 aspect-918/980 w-[min(calc(100%-3rem),calc((94svh-3rem)*918/980))] -translate-x-1/2 @container bg-[url(/images/cooldown-poster.webp)] bg-contain bg-center bg-no-repeat"
  >
    <!-- La bannière en haut du poster, plus étroite que le panneau et décalée
         à droite par la corde nouée sur le piquet gauche. Elle porte le décompte
         pendant l'attente : c'est le seul chiffre que le joueur vient chercher,
         et le drapeau est ce qu'on lit en premier. Hors attente il n'y a plus
         rien à décompter : la bannière dit que l'attente est finie.
         `tabular-nums` comme le chrono de l'ascension, sinon le cadrage tremble
         à chaque seconde ; pas d'`uppercase` sur le décompte, qui rendrait
         « 4m 12s » en « 4M 12S ». -->
    <h1
      class="absolute left-[19.5%] top-[2%] flex h-[13%] w-[69%] items-center justify-center text-center font-semibold tracking-wide text-amber-800"
      :class="state.phase === 'cooldown' ? '-translate-y-[0.5cqw] text-[9.35cqw] leading-none tabular-nums' : 'text-[5cqw] uppercase'"
    >
      {{ state.phase === 'cooldown' ? (waitRemaining || 'Attente') : 'Attente terminée' }}
    </h1>

    <!-- Le panneau de parchemin porte tout ce que l'écran a à dire : décompte,
         rappels, résultat de coffre et sorts en attente. Le contenu est écrit
         ici en tons parchemin plutôt que repris des composants Base*, qui
         portent le thème sombre — les recouvrir en ligne est ce que CLAUDE.md
         interdit, et c'est déjà le parti pris de QuestionCard et de ChestCard,
         qui porte sa propre copie des messages de coffre pour la même raison.

         Le panneau ne défile pas : un parchemin cloué entre deux piquets ne
         défile pas. L'échelle est donc calculée pour que le pire cas tienne.
         Tout étant en cqw, le contenu occupe la même fraction du panneau quelle
         que soit la taille de la fenêtre : ce qui tient tient partout, et seule
         la quantité de contenu compte. Panneau = 46% de la hauteur du poster (il
         s'arrête au bouton, qui mord sur le parchemin), soit 49 cqw ; le cumul le
         plus lourd (attente admin + rattrapage raté + Répit + coffre + sorts +
         chargement) en pèse ~42, le décompte étant passé dans la bannière. -->
    <div
      class="absolute left-[23%] top-[21%] flex h-[46%] w-[62%] flex-col items-center justify-center gap-[1.5cqw] overflow-hidden px-[2cqw] text-center text-[2.6cqw] leading-snug text-amber-800"
    >
      <!-- Le décompte est monté dans la bannière : le répéter ici ferait lire
           deux fois le même chiffre à dix centimètres d'écart. Une seule phrase
           pour les deux phases : ce que le joueur a à faire, attendre ou jouer. -->
      <p class="text-[4.16cqw]">
        {{ state.phase === 'cooldown' && state.cooldownUntil ? `Reviens ${formatReturnAt(state.cooldownUntil, Date.now())} pour tenter le rattrapage.` : 'Tu peux lancer ton rattrapage.' }}
      </p>

      <!-- Ce qui est posé sur le joueur : la plupart des sorts attendent sa
           prochaine tentative, le Répit a déjà agi sur l'attente qu'il lit.
           Voir specs/bonus.md#ancrage-et-durée-de-vie. -->
      <div
        v-if="screen.pendingEffects.length"
        class="mt-[5cqw] w-full"
      >
        <p class="text-[2.3cqw] font-semibold uppercase tracking-wide text-amber-900/70">
          Sorts lancés sur toi
        </p>
        <!-- Le sort écrit en toutes lettres plutôt qu'EffectPip, qui sert aux
             rubans de l'ascension et tait le sort faute de place — le poster en
             a. -->
        <div class="mt-[1.2cqw] flex flex-wrap justify-center gap-[1cqw]">
          <SpellMention
            v-for="(effect, index) in screen.pendingEffects"
            :key="index"
            :subject="effect"
            class="text-[2.1cqw]"
          />
        </div>
      </div>

      <ParchmentNote v-if="loading">
        Mise à jour de ta partie…
      </ParchmentNote>
    </div>

    <!-- Les deux actions ne coexistent jamais : « Passer l'attente » n'existe
         que pour l'admin pendant le cooldown, « Commencer »
         qu'une fois l'attente échue. Un seul emplacement suffit donc, entre le
         bas du panneau et les pierres des piquets. -->
    <CardButton
      v-if="action"
      :label="action.label"
      anchor="poster"
      face="plank"
      :loading="advancing"
      @click="$emit('advance')"
    />
    <CardButton
      v-else-if="isAdmin"
      label="Passer"
      anchor="poster"
      face="plank"
      :loading="skipping"
      @click="$emit('skipCooldown')"
    />
  </div>
</template>

<script setup lang="ts">
// L'écran d'attente — cooldown comme rattrapage prêt à démarrer. Partagé entre
// la vraie partie (pages/index.vue) et son banc de design (pages/test/wait.vue) :
// modifier l'un modifie l'autre, comme QuestionCard pour l'ascension.
//
// Reskin parchemin/médiéval au même titre que l'ascension : les deux phases se
// jouent au camp, donc les deux reçoivent le décor. Tout le contenu vit sur le
// poster, positionné en absolu et dimensionné en cqw — rien ne subsiste sous
// l'image. Voir specs/ecrans.md#cooldown--attente.
import type { GameState } from '~~/server/utils/game'
import type { TeamId } from '~~/shared/utils/teams'
import type { GameScreen, PlayAction } from '~~/utils/phase'

const props = defineProps<{
  state: GameState
  screen: GameScreen
  /** « Commencer » une fois l'attente échue, null pendant. Voir utils/phase.ts (playView). */
  action: PlayAction | null
  waitRemaining: string
  loading: boolean
  isAdmin: boolean
  skipping: boolean
  advancing: boolean
  /** La guilde du joueur, qui choisit la couleur de la bannière. Sans équipe, pas de bannière. */
  team: TeamId | null
}>()

defineEmits<{ skipCooldown: [], advance: [] }>()

interface CampProp {
  src: string
  /** Position et largeur en % du décor 1920×1080, relevées sur le calque d'origine. */
  place: string
  /** Page ouverte au clic. */
  to?: string
  label?: string
  /** Lance le rattrapage, comme « Commencer ». */
  advance?: boolean
}

const BANNERS: Record<TeamId, string> = {
  AZURE: '/images/cooldown-banner-azure.webp',
  CRIMSON: '/images/cooldown-banner-crimson.webp',
}

// La corde déroulée dit que l'on peut remonter : elle n'apparaît qu'avec
// l'action qui suit l'attente — rattrapage ou ascension, selon ce que le serveur
// propose — et la déclenche. Pendant l'attente, roulée au sol, elle n'est que
// décor.
//
// Le parchemin et le sac mènent à des pages pas encore créées : décor sans lien
// d'ici là, plutôt qu'un lien vers une 404.
// Au survol, un objet cliquable se soulève et luit d'un halo argenté. Deux
// drop-shadow superposés plutôt qu'une box-shadow : ils suivent le contour
// détouré de l'image, pas son rectangle — un cœur blanc serré pour l'éclat,
// un voile gris-bleu plus large pour l'argent. Le halo s'étend aux
// étincelles, qui n'en ont pas d'autre.
const HOVER = 'group transition duration-200 hover:scale-[1.01] hover:[filter:drop-shadow(0_0_3px_rgb(255_255_255/0.95))_drop-shadow(0_0_12px_rgb(203_213_225/0.85))]'

/**
 * Les étincelles du survol, en % de la boîte de l'objet : semées sur toute sa
 * surface, l'objet étant de forme quelconque (corde haute et fine, sac large),
 * délais étalés sur le cycle de `animate-sparkle`. Taille en % de la largeur.
 */
const CAMP_SPARKS = [
  { left: '12%', top: '18%', size: '9%', delay: '0s' },
  { left: '78%', top: '10%', size: '7%', delay: '0.6s' },
  { left: '45%', top: '42%', size: '6%', delay: '1.1s' },
  { left: '85%', top: '58%', size: '8%', delay: '0.3s' },
  { left: '20%', top: '72%', size: '6%', delay: '0.9s' },
  { left: '60%', top: '84%', size: '7%', delay: '1.4s' },
]

// La boîte du décor : le `bg-cover bg-center` de cooldown-bg.webp, reproduit.
const COVER = 'top-1/2 w-[max(100cqw,100cqh*16/9)] -translate-y-1/2'

// La boîte du sol : la même tant que la fenêtre est plus étroite que 16:9 (le
// cover y est alors calé sur la hauteur). Plus large, le cover se cale sur la
// largeur et rogne le bas du décor — les objets posés y tombaient à moitié hors
// écran, et grossissaient quand le poster, lui, suit la hauteur. Le sol reste
// donc calé sur la hauteur et posé au bas de la fenêtre : mêmes taille et
// place par rapport au poster qu'en 16:9, quelle que soit la largeur.
const GROUND = 'bottom-0 w-[calc(100cqh*16/9)]'

// Ce qui pend grandit depuis son point d'attache, ce qui est posé depuis le
// sol : centré, le scale ferait décoller les objets ou glisser la corde.
const layers = computed((): { depth: string, box: string, origin: string, items: CampProp[] }[] => [
  // La corde suit le sol, où elle repose, déroulée ou non : calée sur le
  // décor, son rouleau tombait hors écran sur une fenêtre large. Déroulée, elle
  // descend du haut de la fenêtre jusqu'au sol, à toutes les largeurs. Derrière
  // le poster, comme la bannière, et non devant avec le reste du sol.
  {
    depth: 'z-[5]',
    box: GROUND,
    origin: 'origin-top',
    items: [
      props.action
        ? { src: '/images/cooldown-rope-up.webp', place: 'left-[17.92%] top-0 w-[15%]', advance: true }
        : { src: '/images/cooldown-rope-coiled.webp', place: 'left-[21.61%] top-[83.33%] w-[11.3%]' },
    ],
  },
  {
    depth: 'z-[5]',
    box: COVER,
    origin: 'origin-top',
    items: [
      ...(props.team ? [{ src: BANNERS[props.team], place: 'left-[78.33%] top-[14.44%] w-[16.72%]', to: '/succes', label: 'Mes succès' }] : []),
    ],
  },
  {
    // Sur mobile le cover zoome sur le centre du décor : le livre y monterait
    // sur « Commencer ». Le sol y repasse donc derrière le poster.
    depth: 'z-[5] sm:z-20',
    box: GROUND,
    origin: 'origin-bottom',
    items: [
      { src: '/images/cooldown-scroll.webp', place: 'left-[32.55%] top-[84.44%] w-[14.95%]' },
      { src: '/images/cooldown-book.webp', place: 'left-[45.94%] top-[80%] w-[16.61%]', to: '/sorts', label: 'Mes sorts' },
      { src: '/images/cooldown-backpack.webp', place: 'left-[60.42%] top-[78.7%] w-[21.35%]' },
    ],
  },
])
</script>
