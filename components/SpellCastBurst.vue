<template>
  <!-- Posé par l'appelant sur le rond de la face lancée, à sa taille : tout se
       compte en largeur de médaillon. La pièce part de là et va se jouer au
       centre de l'écran, (--to-x, --to-y) plus loin. @container : étincelles
       et arcs comptent leur course en cqw, donc en médaillons. -->
  <div
    ref="root"
    class="pointer-events-none @container aspect-square"
    :style="{ '--cast-glow': CAST_GLOWS[cast.face], '--to-x': toCenter.x, '--to-y': toCenter.y }"
  >
    <!-- Derrière la pièce, au centre de l'écran : la vignette qui éteint tout
         le reste, et la foudre du climax — elle part de derrière la pièce, qui
         cache son départ. -->
    <div class="absolute inset-0 [translate:var(--to-x)_var(--to-y)]">
      <div
        class="absolute left-1/2 top-1/2 aspect-square w-[6000%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle_closest-side,transparent_4%,rgb(15_10_30/0.65)_16%)]"
        :class="{
          'motion-safe:animate-fade-in': cast.stage === 'charging',
          'motion-safe:animate-fade-out [--enter-delay:3.6s]': cast.stage === 'release',
          'motion-safe:animate-fade-out [--enter-delay:0.35s]': cast.stage === 'fizzle',
        }"
      />
      <!-- 100 unités = un médaillon. Un trait blanc, la couleur de la face
           en halo autour : le cœur d'un éclair et sa lueur. -->
      <svg
        v-if="cast.stage === 'release'"
        viewBox="-500 -500 1000 1000"
        class="absolute left-1/2 top-1/2 w-[1000%] -translate-x-1/2 -translate-y-1/2 overflow-visible [filter:drop-shadow(0_0_2px_var(--cast-glow))_drop-shadow(0_0_8px_var(--cast-glow))]"
        aria-hidden="true"
      >
        <path
          v-for="(bolt, index) in STRIKES"
          :key="index"
          :d="bolt.d"
          pathLength="1"
          fill="none"
          stroke="white"
          :stroke-width="bolt.width"
          stroke-linejoin="bevel"
          class="[stroke-dasharray:1] motion-safe:animate-cast-bolt"
          :style="{ animationDelay: bolt.delay }"
        />
      </svg>
    </div>

    <!-- La pièce, dans ses trois boîtes (voir main.css) : l'externe la
         déplace et la grossit — halo, étincelles qui convergent et arcs
         compris —, celle du milieu la fait trembler, l'interne la fait
         tourner. -->
    <div
      class="absolute inset-0"
      :class="{
        'motion-safe:animate-cast-charge': cast.stage === 'charging',
        'motion-safe:animate-cast-release': cast.stage === 'release',
        'motion-safe:animate-cast-fizzle': cast.stage === 'fizzle',
      }"
    >
      <!-- Le halo pulse pendant la montée, et s'éteint sous la foudre. -->
      <div
        class="absolute left-1/2 top-1/2 aspect-square w-[240%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,var(--cast-glow)_0%,var(--cast-glow)_25%,transparent_68%)]"
        :class="cast.stage === 'charging'
          ? 'opacity-0 motion-safe:animate-cast-halo'
          : 'scale-160 motion-safe:animate-fade-out [--enter-delay:0.12s]'"
      />

      <SparkleSpray
        v-if="cast.stage === 'charging'"
        inward
        :sparks="CONVERGE"
        class="drop-shadow-[0_0_4px_var(--cast-glow)]"
      />

      <div
        class="absolute inset-0 [perspective:300cqw]"
        :class="{ 'motion-safe:animate-cast-quiver': cast.stage === 'charging' }"
      >
        <div
          class="relative size-full"
          :class="{
            'motion-safe:animate-cast-spin': cast.stage === 'charging',
            'motion-safe:animate-cast-land': cast.stage === 'release',
          }"
        >
          <SpellMedallion
            :spell="cast.spell"
            :face="cast.face"
            class="size-full [filter:drop-shadow(0_4px_6px_rgb(0_0_0/0.45))_drop-shadow(0_0_10px_var(--cast-glow))]"
            fallback-class="border-2 border-spell-page/60 bg-amber-50 text-[60cqw] text-spell-page"
          />
        </div>
      </div>

      <!-- Les arcs qui crépitent sur son bord pendant la montée, devant elle.
           Même dessin que la foudre, en petit. -->
      <svg
        v-if="cast.stage === 'charging'"
        viewBox="-150 -150 300 300"
        class="absolute left-1/2 top-1/2 w-[300%] -translate-x-1/2 -translate-y-1/2 overflow-visible [filter:drop-shadow(0_0_2px_var(--cast-glow))_drop-shadow(0_0_5px_var(--cast-glow))]"
        aria-hidden="true"
      >
        <path
          v-for="(arc, index) in CRACKLES"
          :key="index"
          :d="arc.d"
          fill="none"
          stroke="white"
          :stroke-width="arc.width"
          stroke-linejoin="bevel"
          class="opacity-0 motion-safe:animate-cast-crackle"
          :style="{ animationDelay: arc.delay }"
        />
      </svg>
    </div>

    <!-- Devant la pièce, au centre de l'écran : la lumière de la foudre, deux
         ondes de choc, la gerbe, puis le titre. Ils restent où elle a éclaté
         quand elle s'envole. -->
    <div
      v-if="cast.stage === 'release'"
      class="absolute inset-0 [translate:var(--to-x)_var(--to-y)]"
    >
      <div
        class="absolute left-1/2 top-1/2 aspect-square w-[900%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,white_0%,var(--cast-glow)_18%,transparent_55%)] opacity-0 motion-safe:animate-cast-strobe"
        :style="{ animationDelay: `${CLIMAX_S}s` }"
      />
      <div
        v-for="delay in [CLIMAX_S, CLIMAX_S + 0.12]"
        :key="delay"
        class="absolute left-1/2 top-1/2 aspect-square w-[240%] -translate-x-1/2 -translate-y-1/2 rounded-full border-[color:var(--cast-glow)] opacity-0 drop-shadow-[0_0_6px_var(--cast-glow)] [border-width:4cqw] motion-safe:animate-cast-shockwave"
        :style="{ animationDelay: `${delay}s` }"
      />
      <SparkleSpray
        :sparks="SPRAY"
        class="drop-shadow-[0_0_6px_var(--cast-glow)]"
      />

      <!-- À qui le sort est allé, une fois la pièce envolée, dans l'éclat du
           titre du Grimoire et la couleur de sa magie — ombre pleine : il peut
           tomber sur le papier clair. Il s'efface avec la vignette. Deux
           boîtes : le fondu de sortie et le rebond d'arrivée animent chacun la
           leur. `w-max` : posée dans une boîte d'un médaillon de large, la
           ligne se mesurerait sur elle. -->
      <div
        v-if="cast.headline"
        class="absolute left-1/2 top-1/2 w-max -translate-x-1/2 -translate-y-1/2 motion-safe:animate-fade-out [--enter-delay:3.6s]"
      >
        <p class="text-center text-[max(2rem,6dvh)] leading-tight motion-safe:animate-cheer [--enter-delay:1.05s]">
          <BaseGlowLabel :color="CAST_GLOWS[cast.face]">
            {{ cast.headline[0] }}<br>{{ cast.headline[1] }}
          </BaseGlowLabel>
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Le lancer d'un sort, sur le médaillon de la face que la cible lui donne :
// il quitte son rond pour le centre de l'écran, s'y charge comme une pièce
// qu'on fait tourner, éclate sous la foudre, retombe à plat et s'envole — puis
// le titre dit à qui le sort est allé. S'il n'est pas parti, la pièce
// s'éteint et retombe dans son rond. Les étapes viennent de
// composables/useSpellCast.ts, leurs mouvements de assets/css/main.css.
//
// Les douze principes, où ils jouent : écrasement et étirement au décollage,
// à l'éclat et à l'envol ; anticipation avant chacun (il s'écrase, inspire,
// plonge) ; mise en scène par la vignette et le centre de l'écran ; poses
// clés pour la pièce, éclairs et gerbes générés au fil de l'eau ; la foudre,
// la gerbe et le titre qui survivent à la pièce ; une courbe par étape ; arcs
// au décollage et à l'envol ; ondes de choc en action secondaire ; un
// tremblement et un crépitement qui accélèrent ; l'exagération du climax ; le
// volume de la pièce qui tourne ; l'or ou le violet de la face.
import type { SpellCast } from '~~/composables/useSpellCast'

defineProps<{ cast: SpellCast }>()

const root = useTemplateRef<HTMLElement>('root')

/**
 * Du centre du rond au centre de l'écran, en pixels. Mesuré une fois, au
 * montage — avant la première image : la pièce s'écrase d'abord dans son rond,
 * elle ne part qu'ensuite. Une translation plutôt qu'une pièce posée en
 * `fixed` : les boîtes animées du Grimoire (son entrée, l'encre) captent le
 * `fixed`, qui se placerait sur elles et non sur l'écran.
 */
const toCenter = ref({ x: '0px', y: '0px' })

onMounted(() => {
  const box = root.value!.getBoundingClientRect()
  toCenter.value = {
    x: `${Math.round(innerWidth / 2 - (box.left + box.width / 2))}px`,
    y: `${Math.round(innerHeight / 2 - (box.top + box.height / 2))}px`,
  }
})

/** L'instant du climax dans `animate-cast-release`, en secondes (8,5 % de 1,4 s). */
const CLIMAX_S = 0.12

/**
 * Un hasard figé : les éclairs ont la même forme à chaque rendu, mais aucun ne
 * ressemble à son voisin.
 */
function noise(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

/** Un trait de foudre ou un arc, en unités du SVG (100 = un médaillon). */
interface Bolt {
  d: string
  width: number
  delay: string
}

type Point = [number, number]

/**
 * Une ligne brisée qui part de `origin`, à `from` de lui, et file sur `length`
 * dans la direction `angle` (en degrés), chaque coude rejeté de côté jusqu'à
 * `jag`. Rend aussi son coude du milieu, d'où une branche peut partir.
 */
function zigzag(origin: Point, angle: number, from: number, length: number, jag: number, seed: number): { d: string, middle: Point } {
  const rad = (angle * Math.PI) / 180
  const points = Array.from({ length: 7 }, (_, step): Point => {
    const along = from + (length * step) / 6
    const side = step ? (noise(seed + step) * 2 - 1) * jag : 0
    return [
      Math.round(origin[0] + Math.cos(rad) * along - Math.sin(rad) * side),
      Math.round(origin[1] + Math.sin(rad) * along + Math.cos(rad) * side),
    ]
  })

  return {
    d: points.map(([x, y], step) => `${step ? 'L' : 'M'}${x} ${y}`).join(' '),
    middle: points[3]!,
  }
}

/**
 * La foudre du climax, en deux salves : sept éclairs tout autour au moment où
 * la pièce éclate, puis cinq plus courts qui frappent à nouveau pendant la
 * pause, entre les premiers. Chacun lance une branche depuis son milieu, un
 * peu après lui. Ils partent de 140, sous le bord de la pièce (elle fait alors
 * 320 de large).
 */
const STRIKES: Bolt[] = [
  { count: 7, start: CLIMAX_S, offset: 0, length: 340 },
  { count: 5, start: 0.48, offset: 26, length: 240 },
].flatMap(({ count, start, offset, length }) =>
  Array.from({ length: count }, (_, index) => {
    const seed = start * 100 + index * 10
    const angle = offset + (index * 360) / count + (noise(seed) - 0.5) * 30
    const reach = length * (0.8 + noise(seed + 9) * 0.4)
    const main = zigzag([0, 0], angle, 140, reach, 26, seed)
    const fork = zigzag(main.middle, angle + (noise(seed + 7) > 0.5 ? 32 : -32), 0, reach * 0.4, 14, seed + 50)
    const delay = start + (index % 3) * 0.03

    return [
      { d: main.d, width: 6, delay: `${delay.toFixed(2)}s` },
      { d: fork.d, width: 3.5, delay: `${(delay + 0.03).toFixed(2)}s` },
    ]
  }).flat())

/**
 * Les arcs de la montée : cinq petits éclairs sur le bord de la pièce, chacun
 * décalé dans le même crépitement. Ils partent de 42, juste sous le bord (la
 * pièce fait 100 dans la boîte qui grossit avec elle).
 */
const CRACKLES: Bolt[] = [25, 115, 200, 290, 340].map((angle, index) => ({
  d: zigzag([0, 0], angle, 42, 38, 9, angle).d,
  width: 4,
  delay: `${[0, 0.07, 0.13, 0.04, 0.1][index]}s`,
}))

/**
 * Les étincelles qui convergent pendant la montée : trois vagues de cinq,
 * chacune tournée par rapport à la précédente, une sur deux de plus loin.
 * Chacune arrive au centre 0,7 s après son départ, avant la fin de la montée
 * (1,5 s). En cqw, mais dans la boîte qui grossit avec la pièce.
 */
const CONVERGE = Array.from({ length: 15 }, (_, index) => {
  const wave = Math.floor(index / 5)
  const angle = ((index * 72 + wave * 24) * Math.PI) / 180
  const distance = index % 2 ? 170 : 220

  return {
    dx: `${Math.round(Math.cos(angle) * distance)}cqw`,
    dy: `${Math.round(Math.sin(angle) * distance)}cqw`,
    size: index % 2 ? '10%' : '15%',
    delay: `${(0.3 + wave * 0.2 + (index % 3) * 0.04).toFixed(2)}s`,
  }
})

/**
 * La gerbe du climax : douze étincelles en étoile, une sur deux plus loin et
 * plus grosse. La pièce fait alors un peu plus de trois médaillons de large :
 * elles partent de son bord.
 */
const SPRAY = Array.from({ length: 12 }, (_, index) => {
  const angle = ((index * 30 + (index % 2) * 12) * Math.PI) / 180
  const distance = index % 2 ? 240 : 320

  return {
    dx: `${Math.round(Math.cos(angle) * distance)}cqw`,
    dy: `${Math.round(Math.sin(angle) * distance)}cqw`,
    size: index % 2 ? '24%' : '36%',
    delay: `${(CLIMAX_S + (index % 3) * 0.03).toFixed(2)}s`,
  }
})
</script>
