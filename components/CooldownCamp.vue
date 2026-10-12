<template>
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
        v-for="item in layer.items"
        :key="item.src"
      >
        <!-- Tous les objets se survolent, pour leur nom ; seuls ceux qui
             mènent quelque part luisent et scintillent en plus. Le lien ou le
             bouton se pose par-dessus l'objet (BaseSurfaceButton), annoncé sous le
             nom affiché : ce qu'on lit et ce qu'on entend ne divergent pas. -->
        <div
          class="group pointer-events-auto absolute"
          :class="[item.place, layer.origin, item.click && HOVER]"
        >
          <img
            :src="item.src"
            alt=""
            class="w-full"
          >
          <SparkleField
            v-if="item.click"
            :sparks="CAMP_SPARKS"
            class="opacity-0 transition-opacity duration-200 group-hover:opacity-100"
          />
          <!-- Le nom de l'objet, blanc et lumineux, ses propres étincelles
               au-dessus. En cqh : il suit la hauteur de la fenêtre, comme les
               objets du sol. Au focus clavier aussi, pas seulement au survol.
               L'ombre sombre au plus près détache le blanc du décor clair ; le
               halo bleuté, plus large, garde l'éclat. -->
          <span
            class="pointer-events-none absolute -translate-x-1/2 whitespace-nowrap text-center text-[3cqh] font-semibold tracking-wide text-white opacity-0 transition-opacity duration-200 [text-shadow:0_1px_2px_rgb(0_0_0/0.85),0_0_6px_rgb(0_0_0/0.6),0_0_14px_rgb(191_219_254/0.7)] group-focus-within:opacity-100 group-hover:opacity-100"
            :class="item.labelAt ?? 'bottom-full left-1/2 mb-[0.5cqh]'"
          >
            {{ item.title }}
            <span
              v-if="item.note"
              class="block text-[0.6em] font-normal"
            >{{ item.note }}</span>
            <SparkleField
              :sparks="LABEL_SPARKS"
              class="drop-shadow-[0_0_3px_#fff]"
            />
          </span>
          <BaseSurfaceButton
            v-if="item.click"
            :label="item.title"
            :to="item.click === 'advance' ? undefined : item.click.to"
            @click="item.click === 'advance' && !advancing && $emit('advance')"
          />
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
// Le camp de l'écran d'attente : corde, bannière de guilde, parchemin, grimoire
// et sac, posés sur le décor de CooldownCard entre lui et le poster. Certains
// mènent ailleurs, tous disent leur nom au survol.
import type { TeamId } from '~~/shared/utils/teams'

const props = defineProps<{
  /** L'attente est échue : la corde se déroule et lance la suite. */
  ready: boolean
  advancing: boolean
  /** La guilde du joueur, qui choisit la couleur de la bannière. Sans équipe, pas de bannière. */
  team: TeamId | null
}>()

defineEmits<{ advance: [] }>()

/** Ce que fait un clic sur l'objet : ouvrir une page, ou lancer la suite. */
type CampClick = { to: string } | 'advance'

interface CampItem {
  src: string
  /** Position et largeur en % du décor 1920×1080, relevées sur le calque d'origine. */
  place: string
  /** Le nom affiché au survol, et annoncé en synthèse vocale. */
  title: string
  /** Une précision sous le nom, plus petite. */
  note?: string
  /** Où poser ce nom, si « au-dessus de l'objet » ne convient pas. */
  labelAt?: string
  /** Sans clic, l'objet n'est que décor : il dit son nom, sans luire. */
  click?: CampClick
}

const BANNERS: Record<TeamId, string> = {
  MIDI: '/images/cooldown-banner-midi.webp',
  TLM: '/images/cooldown-banner-tlm.webp',
}

// La corde déroulée dit que l'on peut remonter : elle n'apparaît qu'avec
// l'action qui suit l'attente — rattrapage ou ascension, selon ce que le serveur
// propose — et la déclenche. Pendant l'attente, roulée au sol, elle n'est que
// décor.
//
// Le grimoire ouvre les Sorts tant que le camp est affiché : c'est le moment
// même où ils existent. Voir specs/spec.md#glossaire (Camp).

// Au survol, un objet cliquable se soulève et luit d'un halo argenté. Deux
// drop-shadow superposés plutôt qu'une box-shadow : ils suivent le contour
// détouré de l'image, pas son rectangle — un cœur blanc serré pour l'éclat,
// un voile gris-bleu plus large pour l'argent. Le halo s'étend aux
// étincelles, qui n'en ont pas d'autre.
const HOVER = 'transition duration-200 hover:scale-[1.01] hover:[filter:drop-shadow(0_0_3px_rgb(255_255_255/0.95))_drop-shadow(0_0_12px_rgb(203_213_225/0.85))]'

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

/**
 * Les étincelles du nom, en % de sa boîte : surtout au-dessus du mot, quelques
 * unes débordant sur ses côtés.
 */
const LABEL_SPARKS = [
  { left: '-8%', top: '-30%', size: '11%', delay: '0s' },
  { left: '30%', top: '-55%', size: '8%', delay: '0.7s' },
  { left: '62%', top: '-40%', size: '10%', delay: '0.3s' },
  { left: '96%', top: '-25%', size: '9%', delay: '1.1s' },
  { left: '104%', top: '55%', size: '6%', delay: '0.5s' },
]

// Ce qui pend grandit depuis son point d'attache, ce qui est posé depuis le
// sol : centré, le scale ferait décoller les objets ou glisser la corde.
const layers = computed((): { depth: string, box: string, origin: string, items: CampItem[] }[] => [
  // La corde suit le sol, où elle repose, déroulée ou non : calée sur le
  // décor, son rouleau tombait hors écran sur une fenêtre large. Déroulée, elle
  // descend du haut de la fenêtre jusqu'au sol, à toutes les largeurs. Derrière
  // le poster, comme la bannière, et non devant avec le reste du sol.
  {
    depth: 'z-[5]',
    box: GROUND,
    origin: 'origin-top',
    items: [
      props.ready
        // Déroulée, la corde part du haut de la fenêtre : son nom se pose au-dessus
        // du rouleau, pas au-dessus de l'image.
        ? { src: '/images/cooldown-rope-up.webp', place: 'left-[17.92%] top-0 w-[15%]', title: 'Ascension', labelAt: 'bottom-[13%] left-[61%]', click: 'advance' }
        : { src: '/images/cooldown-rope-coiled.webp', place: 'left-[21.61%] top-[83.33%] w-[11.3%]', title: 'Ascension', note: '(en attente)' },
    ],
  },
  {
    depth: 'z-[5]',
    box: COVER,
    origin: 'origin-top',
    items: [
      // Le nom de la bannière se lit sur l'étoffe, au milieu : au-dessus, il
      // tombait dans le feuillage du haut de l'écran.
      ...(props.team ? [{ src: BANNERS[props.team], place: 'left-[78.33%] top-[14.44%] w-[16.72%]', title: 'Haut-faits', labelAt: 'left-[46%] top-1/2 -translate-y-1/2', click: { to: '/succes' } }] : []),
    ],
  },
  {
    // Entre l'image du poster (z-10) et son contenu (z-[15]) : voir CooldownCard.
    depth: 'z-[12]',
    box: GROUND,
    origin: 'origin-bottom',
    items: [
      { src: '/images/cooldown-scroll.webp', place: 'left-[32.55%] top-[85.94%] w-[14.95%]', title: 'Volumen', click: { to: '/volumen' } },
      // Le grimoire en dernier : il chevauche le parchemin et le sac, et passe
      // devant eux, comme sur l'illustration.
      { src: '/images/cooldown-backpack.webp', place: 'left-[60.42%] top-[78.7%] w-[21.35%]', title: 'Inventaire', click: { to: '/inventaire' } },
      { src: '/images/cooldown-book.webp', place: 'left-[45.94%] top-[81.5%] w-[16.61%]', title: 'Grimoire', click: { to: '/sorts' } },
    ],
  },
])
</script>
