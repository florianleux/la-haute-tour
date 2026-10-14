<template>
  <!-- Un cercle repassé au crayon gras, comme le pentacle sous lui. La place
       et la taille viennent de l'appelant ; `overflow-visible` laisse dépasser
       les traits qui rayonnent. L'esquisse suit le survol de l'ancêtre `group`,
       ou son focus clavier.

       Le cercle est toujours dessiné en entier ; un masque conique en dévoile
       la part déjà passée au crayon. Il balaie depuis le bout d'arc de
       l'esquisse, centré sur `facing` et large de `--crayon-hint`, puis
       referme le cercle dans le sens des aiguilles d'une montre. Les tirets
       SVG (`stroke-dashoffset`) le feraient aussi, mais Chrome les affiche mal
       sous un filtre. -->
  <svg
    viewBox="0 0 100 100"
    class="pointer-events-none overflow-visible duration-300 ease-out [--crayon-hint:90deg] [mask-image:conic-gradient(from_calc(var(--facing)-var(--crayon-hint)/2),#000_var(--crayon-sweep),transparent_0)] [transition-property:--crayon-sweep] motion-reduce:transition-none"
    :class="drawn
      ? '[--crayon-sweep:360deg] motion-safe:animate-crayon-draw'
      : '[--crayon-sweep:0deg] group-hover-or-focus:[--crayon-sweep:var(--crayon-hint)]'"
    :style="{ '--facing': `${facing}deg` }"
    aria-hidden="true"
  >
    <defs>
      <!-- Le crayon : un tracé qui tremble (première turbulence, basse
           fréquence), puis troué de grain (seconde, haute fréquence), comme
           la cire qui accroche le papier. -->
      <filter :id="filterId" x="-30%" y="-30%" width="160%" height="160%">
        <feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves="2" seed="4" result="wobble" />
        <feDisplacementMap in="SourceGraphic" in2="wobble" scale="2.5" xChannelSelector="R" yChannelSelector="G" result="wobbly" />
        <feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="1" seed="9" result="grain" />
        <feColorMatrix in="grain" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -1.5 0 0 0 1.6" result="holes" />
        <feComposite in="wobbly" in2="holes" operator="in" />
      </filter>
    </defs>

    <g :filter="`url(#${filterId})`" stroke="currentColor" fill="none" stroke-linecap="round">
      <path :d="RING_PATH" :stroke-width="drawn ? 6 : 4" />
      <!-- Les rayons jaillissent quand le cercle est presque refermé :
           `crayon-draw` dure 0,4 s. -->
      <template v-if="drawn">
        <line
          v-for="(ray, index) in RAYS"
          :key="index"
          v-bind="ray"
          stroke-width="4.5"
          class="origin-center [transform-box:view-box] motion-safe:animate-crayon-ray"
          :style="{ animationDelay: `${0.3 + index * 0.03}s` }"
        />
      </template>
    </g>
  </svg>
</template>

<script setup lang="ts">
// Le cercle qu'on repasse au crayon autour d'un rond du pentacle : esquissé
// au survol, tracé en entier quand le rond est choisi, avec quelques traits
// qui rayonnent. Voir components/SpellPentacle.vue.

defineProps<{
  /** Le cercle entier et ses rayons. Sinon rien, ou un bout d'arc au survol. */
  drawn: boolean
  /**
   * Où pointe le bout d'arc du survol, en degrés depuis le haut, dans le sens
   * des aiguilles d'une montre : vers le côté le plus dégagé.
   */
  facing: number
}>()

const filterId = `crayon-${useId()}`

/**
 * Un point du viewBox, autour de son centre (50, 50). L'angle se compte comme
 * `facing` et le masque conique : en degrés depuis le haut, dans le sens des
 * aiguilles d'une montre — un seul repère dans tout le composant.
 */
function point(degrees: number, radius: number): [string, string] {
  const angle = ((degrees - 90) * Math.PI) / 180
  return [(50 + Math.cos(angle) * radius).toFixed(2), (50 + Math.sin(angle) * radius).toFixed(2)]
}

/**
 * Un peu plus d'un tour, de rayon qui flotte : la main ne referme jamais un
 * cercle pile sur son départ. Le masque choisit ce qui s'en voit ; le départ,
 * lui, ne fixe que l'endroit où le trait se chevauche, en haut.
 */
const RING_PATH = Array.from({ length: 73 }, (_, index) => {
  const turn = index / 72
  const [x, y] = point(-10 + turn * 380, 40 + turn * 2 + Math.sin(turn * 11) * 0.8)
  return `${index ? 'L' : 'M'}${x} ${y}`
}).join(' ')

/** Les traits qui rayonnent : sept, irréguliers, en couronne hors du cercle. */
const RAYS = [10, 55, 95, 140, 185, 235, 290].map((degrees, index) => {
  const [x1, y1] = point(degrees, 47)
  const [x2, y2] = point(degrees, 47 + (index % 2 ? 6 : 9))
  return { x1, y1, x2, y2 }
})
</script>
