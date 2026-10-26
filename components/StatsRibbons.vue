<template>
  <!-- Les rubans sont redessinés ici, mobiles, à partir de l'illustration du
       cadre (que PlayFrame rogne à son cadre seul) : chaque ruban est la même
       image, rognée par clip-path à son rectangle. Rognage et textes vivent
       dans un même calque plein cadre, si bien que le ruban et ses chiffres
       bougent ensemble et que les positions en % restent celles du cadre.
       Desktop : six rubans qui sortent de derrière le cadre, l'un après
       l'autre. Mobile : deux rubans pendants, chacun déroulé d'un bloc avec
       ses trois calques par le côté qui les porte. -->

  <!-- Étage / Palier / Série. Desktop : rubans verts à gauche du parchemin.
       Mobile (mobile-play-card.webp) : le ruban vert pend sous le cadre plutôt
       qu'à côté — les trois chiffres s'y empilent, plus serrés et centrés. -->
  <div :class="SIDE">
    <div :class="MOBILE_SLICE" class="[clip-path:inset(71.3%_50%_0_0)]" />
    <div :class="LEFT">
      <div :class="DESK_SLICE" class="sm:[clip-path:inset(0_82.2%_68%_0)]" />
      <p
        class="absolute left-[5%] top-[75%] w-[24%] text-center text-[3.4cqw] font-bold uppercase tracking-widest text-emerald-950/70 sm:left-[3%] sm:top-[8%] sm:w-[14%] sm:text-right sm:text-[1.1cqw]">
        Étage
      </p>
      <p
        class="absolute left-[5%] top-[76%] w-[24%] text-center text-[7cqw] font-bold text-emerald-950 sm:left-[3%] sm:top-[7%] sm:w-[14%] sm:text-right sm:text-[5.4cqw]">
        {{ state.floor }}
      </p>
    </div>
    <div :class="LEFT" class="sm:[--enter-delay:0.37s]">
      <div :class="DESK_SLICE" class="sm:[clip-path:inset(32%_82.2%_40%_0)]" />
      <p
        class="absolute left-[5%] top-[81%] w-[24%] text-center text-[3.4cqw] font-bold uppercase tracking-widest text-emerald-950/70 sm:left-[3%] sm:top-[38%] sm:w-[14%] sm:text-right sm:text-[1cqw]">
        Palier
      </p>

      <span
        class="absolute left-[5%] top-[82%] w-[24%] text-center text-[7cqw] font-bold text-emerald-950 sm:left-[3%] sm:top-[39%] sm:w-[14%] sm:text-right sm:text-[3.3cqw]"
      >
        <span
          :class="counted && BUMPED"
          :style="{ '--enter-delay': `${TICKS.floorSeen}ms` }"
        >{{ state.floorSeen - (ticked.floorSeen ? 0 : 1) }}<span
          v-if="counted"
          :class="PLUS_ONE"
        >+1</span></span>
      </span>
      <span
        class=" invisible sm:visible  sm:absolute left-[19%] top-[83%] w-[10%] text-left text-[2.4cqw] text-emerald-950 sm:left-[3%] sm:top-[49%] sm:w-[14%] sm:text-right sm:text-[1.1cqw]"
      >/{{ state.floorTotal }}</span>
    </div>
    <div :class="LEFT" class="sm:[--enter-delay:0.44s]">
      <div :class="DESK_SLICE" class="sm:[clip-path:inset(60%_82.2%_0_0)]" />
      <p
        class="absolute left-[5%] top-[87%] w-[24%] text-center text-[3.4cqw] font-bold uppercase tracking-widest text-emerald-950/70 sm:left-[3%] sm:top-[68.5%] sm:w-[14%] sm:text-right sm:text-[1cqw]">
        Série
      </p>
      <p
        class="absolute left-[5%] top-[88%] w-[24%] text-center text-[7cqw] font-bold text-emerald-950 sm:left-[3%] sm:top-[69%]  sm:w-[14%] sm:text-right sm:text-[3.3cqw]">
        <span
          :class="streakGained && BUMPED"
          :style="{ '--enter-delay': `${TICKS.streak}ms` }"
        >{{ state.streak - (ticked.streak ? 0 : 1) }}<span
          v-if="streakGained"
          :class="PLUS_ONE"
        >+1</span></span>
      </p>
    </div>
  </div>

  <!-- Vies / Bonus / Malus. Desktop : rubans roses à droite du parchemin.
       Mobile : ruban rose sous le cadre, symétrique du vert. -->
  <div :class="SIDE">
    <div :class="MOBILE_SLICE" class="[clip-path:inset(71.3%_0_0_50%)]" />
    <div :class="RIGHT">
      <div :class="DESK_SLICE" class="sm:[clip-path:inset(0_0_68%_82.2%)]" />
      <p
        class="absolute left-[71%] top-[75%] w-[24%] text-center text-[3.4cqw] font-bold uppercase tracking-widest text-rose-950/70 sm:left-[83%] sm:top-[8%] sm:w-[14%] sm:text-left sm:text-[1.1cqw]">
        Vies
      </p>
      <!-- Trois cœurs d'ordinaire, jusqu'à cinq avec Vitalité : plus petits à
           quatre, en quinconce sur deux lignes à cinq (trois puis deux). -->
      <div
        class="absolute left-[71%] top-[77.5%] flex w-[24%] flex-col items-center leading-none sm:left-[82.6%] sm:top-[12%] sm:w-[14%] sm:items-start"
        :class="HEART_SIZES[heartCount]"
      >
        <p
          v-for="(row, index) in heartRows"
          :key="index"
          :class="{ 'sm:pl-[0.45em]': index > 0 }"
        >
          <span
            v-for="n in row"
            :key="n"
            :class="[n <= state.lives ? 'text-rose-950' : 'text-rose-950/30', n === lostHeart && 'relative inline-block']"
          >♥<template v-if="n === lostHeart">
            <!-- Le cœur plein, posé sur le cœur éteint, qui tremble et éclate. -->
            <span
              class="absolute inset-0 text-rose-950 opacity-0 motion-safe:animate-heart-break"
              :style="{ '--enter-delay': `${TICKS.lives}ms` }"
            >♥</span>
            <SparkleSpray
              :sparks="HEART_SPRAY"
              glow="#e11d48"
            />
            <span class="pointer-events-none absolute inset-x-0 bottom-full flex justify-center">
              <span
                class="whitespace-nowrap text-[9cqw] font-black text-white opacity-0 [text-shadow:0_2px_3px_rgb(76_5_25/0.9),0_0_0.4em_rgb(225_29_72/0.9)] motion-safe:animate-float-away sm:text-[3.6cqw]"
                :style="{ '--enter-delay': `${TICKS.lives + BURST_MS}ms` }"
              >-1</span>
            </span>
          </template></span>
        </p>
      </div>
    </div>
    <div :class="RIGHT" class="sm:[--enter-delay:0.37s]">
      <div :class="DESK_SLICE" class="sm:[clip-path:inset(32%_0_40%_82.2%)]" />
      <p
        class="absolute left-[71%] top-[81%] w-[24%] text-center text-[3.4cqw] font-bold uppercase tracking-widest text-rose-950/70 sm:left-[83%] sm:top-[38%] sm:w-[14%] sm:text-left sm:text-[1cqw]">
        Bonus
      </p>
      <div
        class="pointer-events-auto absolute left-[71%] top-[83.5%] flex w-[24%] justify-center gap-1.5 sm:left-[82.6%] sm:top-[43%] sm:w-[14%] sm:justify-start"
      >
        <template v-if="boons.length">
          <EffectPip
            v-for="(effect, i) in boons"
            :key="i"
            :effect="effect"
          />
        </template>
        <!-- Rien d'actif : un tiret plutôt qu'un ruban vide, qui se lirait
             comme une valeur qui n'a pas chargé. Même hauteur qu'une pastille. -->
        <span
          v-else
          class="text-[6.5cqw] font-bold leading-none text-rose-950/60 sm:ml-[1cqw] sm:text-[3cqw]"
        >-</span>
      </div>
    </div>
    <div :class="RIGHT" class="sm:[--enter-delay:0.44s]">
      <div :class="DESK_SLICE" class="sm:[clip-path:inset(60%_0_0_82.2%)]" />
      <p
        class="absolute left-[71%] top-[87%] w-[24%] text-center text-[3.4cqw] font-bold uppercase tracking-widest text-rose-950/70 sm:left-[83%] sm:top-[68.5%] sm:w-[14%] sm:text-left sm:text-[1cqw]">
        Malus
      </p>
      <div
        class="pointer-events-auto absolute left-[71%] top-[90%] flex w-[24%] justify-center gap-1.5 sm:left-[82.6%] sm:top-[72.5%] sm:w-[14%] sm:justify-start"
      >
        <template v-if="curses.length">
          <EffectPip
            v-for="(effect, i) in curses"
            :key="i"
            :effect="effect"
          />
        </template>
        <span
          v-else
          class="text-[6.5cqw] font-bold leading-none text-rose-950/60 sm:ml-[1cqw] sm:text-[3cqw]"
        >-</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Les rubans latéraux (Étage/Palier/Série à gauche, Vies/Bonus/Malus à
// droite) : partagés entre QuestionCard et ResultCard, mêmes
// chiffres lus depuis le même GameState de part et d'autre. Positions en %,
// tailles en cqw : voir components/QuestionCard.vue pour le détail des
// choix (container-type sur l'ancêtre commun). Classes non préfixées =
// mobile-play-card.webp (rubans sous le cadre) ; `sm:` = game-card.webp
// (rubans à côté), au même point de bascule que le fond lui-même.
import type { GameState } from '~~/server/utils/game'
import type { EffectView } from '~~/server/utils/effects'

const props = defineProps<{
  state: GameState
  effects: EffectView[]
  /**
   * La question qui vient d'être jouée a compté : Palier vient de prendre un,
   * et Série aussi si la réponse était juste — le chiffre gonfle, un « +1 »
   * s'en échappe. Une faute remet la Série à zéro, sans fanfare.
   */
  counted?: boolean
  /** La question qui vient d'être jouée a coûté une vie : son cœur éclate. */
  lifeLost?: boolean
}>()

/**
 * Les cœurs du ruban, en lignes : trois au moins, le cœur éteint d'une
 * Vitalité noire compris ; autant que la tentative en compte au-delà, cinq au
 * plus. À cinq, trois puis deux, en quinconce. Voir specs/bonus.md (Vitalité).
 */
const heartCount = computed(() => Math.min(5, Math.max(3, props.state.maxLives, props.state.lives)))

const heartRows = computed((): number[][] => {
  const hearts = Array.from({ length: heartCount.value }, (_, index) => index + 1)

  return heartCount.value === 5 ? [hearts.slice(0, 3), hearts.slice(3)] : [hearts]
})

/** Plus il y a de cœurs, plus ils rapetissent, pour tenir dans le ruban. */
const HEART_SIZES: Record<number, string> = {
  3: 'text-[5cqw] sm:text-[4cqw]',
  4: 'text-[4.2cqw] sm:text-[3.2cqw]',
  5: 'text-[3.2cqw] sm:text-[2.9cqw]',
}

/** Le cœur qui vient de s'éteindre : le premier après ceux qui restent. */
const lostHeart = computed(() => (props.lifeLost ? props.state.lives + 1 : null))

// Le chiffre qui gonfle, et le « +1 » accroché à lui (`inline-block relative`,
// à sa largeur près) : à droite du chiffre en mobile, où il est centré ; à
// gauche en desktop, où il est collé au cadre qui le masquerait. Le « +1 »
// hérite du délai de son chiffre. Sous « réduire les animations », ni
// gonflement ni « +1 » : le chiffre change, c'est tout.
const BUMPED = 'relative inline-block motion-safe:animate-bump'
const PLUS_ONE = 'pointer-events-none absolute left-full top-0 whitespace-nowrap px-[0.3em] text-[9cqw] font-black text-white opacity-0 [text-shadow:0_2px_3px_rgb(2_44_34/0.9),0_0_0.4em_rgb(16_185_129/0.9)] motion-safe:animate-float-away sm:left-auto sm:right-full sm:text-[3.6cqw]'

/**
 * Quand Palier et Série prennent leur un, en ms après l'arrivée du verdict :
 * après le « Correct ! », décalés de 0,1 s l'un de l'autre. Le délai des
 * animations et le changement de chiffre lisent la même valeur.
 */
const TICKS = { floorSeen: 450, streak: 550, lives: 450 } as const

/**
 * Le cœur perdu éclate à 55 % de `animate-heart-break` (0,7 s) : c'est là que
 * partent ses éclats et son « -1 ». Distances en em du cœur, qui n'a pas la
 * même taille en mobile et en desktop.
 */
const BURST_MS = 385
const HEART_SPRAY = Array.from({ length: 6 }, (_, index) => {
  const angle = ((index * 60 + 30) * Math.PI) / 180

  return {
    dx: `${(Math.cos(angle) * 1.1).toFixed(2)}em`,
    dy: `${(Math.sin(angle) * 1.1).toFixed(2)}em`,
    size: index % 2 ? '0.3em' : '0.45em',
    delay: `${((TICKS.lives + BURST_MS) / 1000 + (index % 3) * 0.03).toFixed(2)}s`,
  }
})

// Le chiffre d'avant tient jusqu'à son tic, puis passe au chiffre du serveur
// en même temps que le « +1 » éclot : sinon le « +1 » s'ajoute à un chiffre
// déjà compté. Ce n'est qu'un retard d'affichage — la valeur montrée reste
// celle de l'état, moins le un qui n'a pas encore été dit.
// La Série ne prend son un que sur une réponse juste. Voir specs/spec.md#glossaire.
const streakGained = computed(() => props.counted && props.state.verdict?.correct === true)

const ticked = reactive({ floorSeen: !props.counted, streak: !streakGained.value })

onMounted(() => {
  for (const key of ['floorSeen', 'streak'] as const) {
    if (!ticked[key]) {
      setTimeout(() => {
        ticked[key] = true
      }, TICKS[key])
    }
  }
})

// Les calques plein cadre ne prennent pas la souris : empilés, le dernier
// couvrirait les pastilles des autres. Seules les pastilles la reprennent.
const SLICE = 'pointer-events-none absolute inset-0 bg-contain bg-center bg-no-repeat'

const LAYER = 'pointer-events-none absolute inset-0'

/**
 * Un côté : ses trois rubans, et en mobile le ruban pendant qui les porte,
 * déroulé d'un bloc depuis le bas du cadre (71,3 % de sa hauteur) après
 * l'impact de `animate-drop-in`. Son délai sert aussi au premier ruban
 * desktop, qui en hérite.
 */
const SIDE = `${LAYER} origin-[50%_71.3%] [--enter-delay:0.3s] max-sm:group-data-arriving:motion-safe:animate-ribbon-unroll`

const MOBILE_SLICE = `${SLICE} bg-[url(/images/mobile-play-card.webp)] sm:hidden`
const DESK_SLICE = `${SLICE} hidden sm:block sm:bg-[url(/images/game-card.webp)]`

/**
 * Un ruban desktop, qui sort de derrière le cadre, pivot au montant du cadre
 * (17,8 % et 82,2 % de sa largeur) pour que le claquement parte de là.
 * --dir : de quel côté il était caché.
 */
const RIBBON = `${LAYER} sm:group-data-arriving:motion-safe:animate-ribbon-out`
const LEFT = `${RIBBON} [--dir:1] sm:origin-[17.8%_50%]`
const RIGHT = `${RIBBON} [--dir:-1] sm:origin-[82.2%_50%]`

const boons = computed(() => props.effects.filter(effect => effect.face === 'boon'))
const curses = computed(() => props.effects.filter(effect => effect.face === 'curse'))
</script>
