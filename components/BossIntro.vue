<template>
  <!-- Le fond uni de l'arche, celui où « Entrer » vient de plonger : l'écran
       de la porte s'efface sur cette couleur, l'introduction part d'elle sans
       couture. Elle s'efface entière à la fin (LEAVE_MS), avant le combat. -->
  <div
    class="fixed inset-0 z-1 overflow-hidden @container-size motion-safe:transition-opacity motion-safe:duration-[800ms]"
    :class="[backdrop, leaving && 'opacity-0']"
  >
    <!-- Dès qu'il paraît, une carte passe derrière lui de temps en temps
         (passerby), petite : plus loin que lui. Avant la scène dans le DOM :
         elle passe sous lui. -->
    <img
      v-for="flyer in passersby"
      :key="flyer.id"
      :src="flyer.image"
      alt=""
      class="pointer-events-none absolute left-0 top-0 motion-safe:animate-swoop"
      :style="flyer.style"
      @animationend="land(passersby, flyer)"
      @animationcancel="land(passersby, flyer)"
    >

    <div :class="[BACKDROP_BOX, BACKDROP_COVER]">
      <div
        class="@container"
        :class="BACKDROP_SCENE"
      >
        <!-- Le boss, à sa place relevée sur son calque, derrière la nuée qui
             cache sa zone. Il y paraît en fondu, sans bouger ni grandir : quand
             les cartes s'écartent, il est déjà là. Son cri le secoue
             longtemps, à un autre rythme que sa fenêtre. -->
        <img
          :src="intro.image"
          alt=""
          class="absolute motion-safe:transition-opacity motion-safe:duration-[800ms]"
          :class="[intro.imageBox, !appeared && 'opacity-0', shaking && 'motion-safe:animate-shout-boss']"
        >

        <!-- Une carte flotte au-dessus de chaque main, chacune à son rythme
             (`hover`, durée et délai propres). Elles paraissent avec lui, du
             même fondu, et tremblent avec lui à son cri, du même tremblement
             (`animate-shout-boss`, en cqw). Devant lui. -->
        <template v-if="intro.levitation && levitationCard">
          <div
            v-for="(spot, rank) in intro.levitation"
            :key="spot"
            class="pointer-events-none absolute -translate-1/2 motion-safe:transition-opacity motion-safe:duration-[800ms]"
            :class="[spot, !appeared && 'opacity-0', shaking && 'motion-safe:animate-shout-boss']"
          >
            <img
              :src="levitationCard"
              alt=""
              class="w-[9cqw] max-w-none motion-safe:animate-hover"
              :style="{ animationDelay: `${-rank * HOVER_STAGGER_S}s`, animationDuration: `${HOVER_S + rank * HOVER_STAGGER_S}s` }"
            >
          </div>
        </template>

        <!-- Son nom en grand titre au-dessus de sa tête, façon Dark Souls,
             son épithète en plus petit juste au-dessus, révélée la première :
             capitales espacées, or en dégradé. Il se révèle de gauche à
             droite (un masque qui glisse), un reflet le balaie, puis il
             s'efface ; son filet s'étire de gauche à droite avec lui. Le tout
             tient le temps du temps qui le montre (`--title-ms`). Pas de
             `text-shadow` : sous un texte à fond découpé, il salirait l'or. -->
        <div
          v-if="beat.cue === 'title'"
          class="absolute inset-x-0 bottom-[79%] flex flex-col items-center motion-safe:animate-title-card"
          :style="{ '--title-ms': `${beat.holdMs ?? 0}ms` }"
        >
          <p
            v-if="intro.epithet"
            class="-mb-[0.4cqw] text-[1.4cqw] leading-none"
            :class="TITLE_GOLD"
          >
            {{ intro.epithet }}
          </p>
          <p
            class="text-[4.6cqw]"
            :class="TITLE_GOLD"
            :style="nameDelay"
          >
            {{ intro.name }}
          </p>
          <div
            class="mt-[0.4cqw] h-[0.15cqw] w-[48cqw] origin-left bg-linear-to-r from-transparent via-[#e6c878] to-transparent motion-safe:animate-title-rule"
            :style="nameDelay"
          />
        </div>
      </div>
    </div>

    <!-- La nuée : chaque objet entre au moment de son départ, traverse
         l'écran une fois et se retire. Une animation retirée en route
         (« réduire les animations » activé) le retire aussi. -->
    <img
      v-for="flyer in flyers"
      :key="flyer.id"
      :src="flyer.image"
      alt=""
      class="pointer-events-none absolute left-0 top-0 z-20 motion-safe:animate-swoop"
      :style="flyer.style"
      @animationend="land(flyers, flyer)"
      @animationcancel="land(flyers, flyer)"
    >

    <!-- La fenêtre, sur un calque de la même scène posé au-dessus de la
         nuée : les cartes passent devant le boss, jamais devant ce qui se dit.
         Elle ne prend pas les clics : ils vont à la surface, dessous. -->
    <div
      class="pointer-events-none z-30"
      :class="[BACKDROP_BOX, BACKDROP_COVER]"
    >
      <div
        class="@container"
        :class="BACKDROP_SCENE"
      >
        <!-- La fenêtre de celui qui a parlé en dernier (`spoken`) : la
             remarque du joueur, aux couleurs de la porte, ou la réplique du
             boss, aux siennes. Elle reste pendant les temps sans réplique
             (apparition, titre). Une fenêtre par interlocuteur (`:key`) : elle
             ne repart en fondu que quand la parole change de bouche. Les deux
             se croisent en fondu, à la même place : pas de `mode="out-in"`,
             qui, la scène se redessinant sans cesse pendant la sortie (défilé,
             nuée), ne montait jamais la fenêtre suivante. -->
        <Transition
          enter-active-class="motion-safe:transition-[opacity,translate] motion-safe:duration-500 motion-safe:ease-out"
          enter-from-class="translate-y-[1.5cqw] opacity-0"
          leave-active-class="motion-safe:transition-opacity motion-safe:duration-300"
          leave-to-class="opacity-0"
          @after-enter="windowEntered = true"
        >
          <BaseDialogueWindow
            v-if="spoken"
            :key="spoken.speaker"
            :remark="shown"
            :colors="spoken.speaker === 'boss' ? intro.windowColors : undefined"
            class="absolute bottom-[5%] left-1/2 w-[51%] -translate-x-1/2"
            :class="shaking && 'motion-safe:animate-shout-window'"
            @animationend="$event.animationName === 'shout-window' && (shaken = true)"
            @animationcancel="$event.animationName === 'shout-window' && (shaken = true)"
          >
            <!-- Le cri, en très gros, mot après mot : chacun s'abat à son
                 tour. Tous sont posés d'emblée, invisibles : la fenêtre a sa
                 taille finale dès le premier. -->
            <span
              v-if="loud"
              class="flex flex-wrap justify-center gap-x-[0.3em] text-[5cqw] font-black leading-tight tracking-wide"
            >
              <span
                v-for="(word, rank) in shoutWords"
                :key="rank"
                class="inline-block motion-safe:animate-impact"
                :style="{ '--enter-delay': `${rank * IMPACT_GAP_MS}ms` }"
              >{{ word }}</span>
            </span>
          </BaseDialogueWindow>
        </Transition>
      </div>
    </div>

    <!-- Le temps attend un clic : on le dit au joueur, en petit, dans le
         coin. Rien pendant qu'un temps avance seul ou que le texte défile. -->
    <Transition
      enter-active-class="motion-safe:transition-opacity motion-safe:duration-500"
      enter-from-class="opacity-0"
    >
      <p
        v-if="awaitingClick"
        class="pointer-events-none absolute bottom-[3cqh] right-[2.5cqw] z-20 text-[max(0.85rem,1cqw)] italic text-[#e6c878]"
      >
        Clique n'importe où pour continuer
      </p>
    </Transition>

    <BaseSurfaceButton
      label="Suite de l'introduction"
      @click="advance"
    />
  </div>
</template>

<script setup lang="ts">
// L'introduction d'un boss (specs/boss.md#introduction-et-animations), la même
// pour tous : seule l'entrée de BOSS_INTROS change d'un étage à l'autre. Elle
// joue ses temps un à un sur le fond de l'arche et rend la main par `end`, à
// charge de l'écran appelant de lancer le combat. Ses images sont déjà là :
// l'écran de chargement du boss les a attendues. Banc : pages/test/door/[floor].vue.
import { BACKDROP_BOX, BACKDROP_COVER, BACKDROP_SCENE } from '~~/utils/backdrop'
import type { BossIntroBeat, BossIntroEntry } from '~~/utils/bossIntros'
import { DIALOGUE_KEYS } from '~~/utils/keyboard'
import { prefersReducedMotion } from '~~/utils/motion'
import { withNonBreakingSpaces } from '~~/utils/typography'

const props = defineProps<{
  intro: BossIntroEntry
  /** Le fond uni de l'arche de la porte (`archColor`), d'où part l'introduction. */
  backdrop: string
}>()

const emit = defineEmits<{ end: [] }>()

/** Le fondu de sortie, avant le combat : `duration-[800ms]` du fond. */
const LEAVE_MS = 800
/** L'or du titre, en dégradé, révélé de gauche à droite : son nom et son épithète. */
const TITLE_GOLD = 'bg-[linear-gradient(100deg,#a8741a_0%,#f6dc8c_30%,#fffbe8_45%,#f6dc8c_60%,#a8741a_100%)] bg-size-[250%_100%] bg-clip-text [-webkit-background-clip:text] uppercase tracking-[0.2em] text-transparent [mask-image:linear-gradient(to_right,black_40%,transparent_60%)] [mask-size:250%_100%] motion-safe:animate-title-reveal'
/** L'avance de l'épithète sur le nom, dans le titre : elle paraît, puis lui. */
const EPITHET_LEAD_MS = 700
/** Le nom et son filet partent ensemble, après l'épithète s'il y en a une. */
const nameDelay = computed(() => (props.intro.epithet ? { animationDelay: `${EPITHET_LEAD_MS}ms` } : undefined))
/** L'écart entre deux mots du cri. */
const IMPACT_GAP_MS = 380
/** Le flottement d'une carte au-dessus d'une main (`hover`), et l'écart de rythme d'une carte à l'autre. */
const HOVER_S = 3
const HOVER_STAGGER_S = 0.7
/**
 * Où les objets en vol se croisent, en % de l'écran : la zone du boss, coin
 * haut gauche de chaque carte compris (une carte fait ~10vw). Approchée sur la
 * scène 16:9, que l'écran montre à peu près entière.
 */
const BOSS_ZONE = { x: [22, 68], y: [30, 80] } as const
/** La distance du point visé au départ et à l'arrivée : assez pour sortir de l'écran dans tous les sens. */
const SWOOP_REACH = 85

/** Des bornes, de la plus petite à la plus grande. */
type Bounds = readonly [number, number]

/** Le vol d'un objet : sa durée (ms) et sa largeur (vw), tirées entre ces bornes. */
interface FlightProfile {
  ms: Bounds
  width: Bounds
}

/** La nuée : vite, et grand — elle passe devant lui. */
const SWARM_FLIGHT: FlightProfile = { ms: [450, 650], width: [9.6, 15.6] }
/** Les cartes qui passent derrière lui : plus lentes, plus petites — plus loin que lui. */
const PASSERBY_FLIGHT: FlightProfile = { ms: [800, 1200], width: [5, 8.1] }
/**
 * L'écart entre deux cartes qui passent derrière lui, tiré entre ces bornes :
 * avec leur vol de 0,8 à 1,2 s, trois ou quatre sont en l'air à la fois.
 */
const PASSERBY_GAP_MS: Bounds = [200, 450]

/** Un temps qui parle : une réplique, dans la fenêtre de son interlocuteur. */
type SpokenBeat = Extract<BossIntroBeat, { speaker: 'player' | 'boss' }>

const index = ref(0)
const beat = computed(() => props.intro.beats[index.value]!)
/** Les temps joués jusqu'ici, celui en cours compris. */
const played = computed(() => props.intro.beats.slice(0, index.value + 1))
/** Le boss a paru : il reste jusqu'à la fin, avec ses cartes. */
const appeared = computed(() => played.value.some(({ cue }) => cue === 'appear'))
/** Le dernier temps qui a parlé : sa fenêtre reste tant que personne d'autre ne parle. */
const spoken = computed(() => played.value.findLast((entry): entry is SpokenBeat => entry.speaker !== undefined))
/** La carte qui flotte au-dessus de ses mains : la première image de sa nuée. */
const levitationCard = computed(() => props.intro.swarm?.images[0])

/** Le boss crie, à ce temps-ci. */
const shouting = computed(() => beat.value.cue === 'shout')
/**
 * Lui, ses cartes et sa fenêtre tremblent. Un état et non `shouting` : il
 * retombe au début de chaque temps et ne repart qu'à l'image suivante, si bien
 * qu'un second cri juste après le premier rejoue sa secousse au lieu de garder
 * celle, finie, du premier.
 */
const shaking = ref(false)
/** La fenêtre montre un cri : en très gros, mot après mot. */
const loud = computed(() => spoken.value?.cue === 'shout')

// Le défilé, au rythme des dialogues. Il ne repart que quand le texte change :
// une fenêtre qui reste pendant un temps sans réplique ne se réécrit pas.
const text = computed(() => withNonBreakingSpaces(spoken.value?.text ?? ''))
const { shown, revealed, restart, revealAll } = useTextReveal(text, ref(REVEAL_MS))
watch(text, restart)
/**
 * La réplique est sortie en entier. Un cri l'est d'emblée : ses mots s'abattent
 * d'eux-mêmes, sans défilé que le premier clic aurait à finir.
 */
const lineOut = computed(() => loud.value || revealed.value)
/** Les mots du cri. Le « ! » reste collé au dernier : l'espace d'avant est insécable. */
const shoutWords = computed(() => text.value.split(' '))

/**
 * Les animations du temps sont finies : l'indication de clic peut paraître.
 * Chacune le dit elle-même en finissant, plutôt qu'une durée recopiée du CSS :
 * la fenêtre qui change de bouche, à la fin de son entrée (`after-enter`) ; la
 * fenêtre qui crie, à la fin de sa secousse (`animationend`).
 */
const windowEntered = ref(true)
const shaken = ref(true)
const settled = computed(() => windowEntered.value && shaken.value)
const leaving = ref(false)
/** Le temps attend le clic du joueur : il ne part pas seul, son texte est sorti, ses animations finies. */
const awaitingClick = computed(() => beat.value.holdMs === undefined && lineOut.value && settled.value && !leaving.value)

// La fenêtre change de bouche : on attend son entrée. Sous « réduire les
// animations », la Transition n'a rien à jouer et la dit entrée d'elle-même.
watch(() => spoken.value?.speaker, (speaker, before) => {
  if (speaker !== before) {
    windowEntered.value = false
  }
})

/** Un objet en vol : son image et sa trajectoire, en variables de `animate-swoop`. */
interface Flyer {
  id: number
  image: string
  style: Record<string, string>
}

/** La nuée, devant tout. */
const flyers = ref<Flyer[]>([])
/** Les cartes qui passent derrière lui, dès qu'il paraît. */
const passersby = ref<Flyer[]>([])
let flyerId = 0

/** Retire de sa liste cet objet, arrivé au bout de son vol. */
function land(list: Flyer[], flyer: Flyer): void {
  const at = list.findIndex(({ id }) => id === flyer.id)
  if (at >= 0) {
    list.splice(at, 1)
  }
}

function between([min, max]: Bounds): number {
  return min + Math.random() * (max - min)
}

/** Les minuteurs en cours, tous arrêtés si l'écran est quitté en route. */
const timers = new Set<ReturnType<typeof setTimeout>>()

function later(run: () => void, ms: number): void {
  const timer = setTimeout(() => {
    timers.delete(timer)
    run()
  }, ms)
  timers.add(timer)
}

/**
 * Un objet qui prend son vol : il vise un point de la zone du boss et la
 * traverse en ligne droite dans une direction tirée au hasard — de côté, de
 * haut en bas, de bas en haut, en oblique. Départ et arrivée à SWOOP_REACH de
 * ce point, hors de l'écran.
 */
function launchFlyer(images: string[], { ms, width }: FlightProfile): Flyer {
  const id = flyerId++
  const x = between(BOSS_ZONE.x)
  const y = between(BOSS_ZONE.y)
  const angle = between([0, 2 * Math.PI])
  const dx = Math.cos(angle) * SWOOP_REACH
  const dy = Math.sin(angle) * SWOOP_REACH
  return {
    id,
    image: images[id % images.length]!,
    style: {
      'width': `${between(width)}vw`,
      '--x0': `${x - dx}vw`,
      '--x1': `${x + dx}vw`,
      '--y0': `${y - dy}vh`,
      '--y1': `${y + dy}vh`,
      '--arc': `${between([-5, 5])}vh`,
      '--turn': `${between([-360, 360])}deg`,
      '--swoop-ms': `${between(ms)}ms`,
    },
  }
}

/**
 * La nuée : ses vagues partent à leur heure, chaque objet entre dans le DOM au
 * moment de son départ — pas avant : un objet posé d'avance, même invisible,
 * tient déjà sa place en mémoire graphique, et 91 d'un coup pèsent sur un iPad.
 * La masse se croise sur le boss et le couvre au mieux. Rien sous « réduire les
 * animations » : sans leur vol, ils resteraient plantés dans un coin.
 */
function releaseSwarm(): void {
  const swarm = props.intro.swarm
  if (!swarm || prefersReducedMotion()) {
    return
  }
  for (const { atMs, count, spreadMs = 0 } of swarm.waves) {
    for (let rank = 0; rank < count; rank++) {
      later(() => {
        // « Réduire les animations » activé en route : une carte sans vol
        // resterait plantée dans un coin.
        if (!prefersReducedMotion()) {
          flyers.value.push(launchFlyer(swarm.images, SWARM_FLIGHT))
        }
      }, atMs + between([0, spreadMs]))
    }
  }
}

/**
 * Une carte passe derrière lui, puis la suivante à une heure imprévisible.
 * Rien tant que l'onglet est caché : les animations y sont suspendues, leurs
 * cartes ne finiraient jamais leur vol et s'entasseraient.
 */
function schedulePasserby(images: string[]): void {
  later(() => {
    if (!document.hidden && !prefersReducedMotion()) {
      passersby.value.push(launchFlyer(images, PASSERBY_FLIGHT))
    }
    schedulePasserby(images)
  }, between(PASSERBY_GAP_MS))
}

watch(appeared, (now) => {
  const images = props.intro.swarm?.images
  if (now && images && !prefersReducedMotion()) {
    schedulePasserby(images)
  }
})

/** Le début d'un temps : son effet, puis son départ seul s'il en a un. */
function startBeat(): void {
  // Sa secousse finie — ou coupée —, la fenêtre qui crie le dira
  // (`animationend`, `animationcancel`) ; sans animation, rien à attendre.
  const still = !shouting.value || prefersReducedMotion()
  shaken.value = still
  shaking.value = false
  if (!still) {
    // Deux images : la secousse retirée doit être peinte avant de repartir.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      shaking.value = true
    }))
  }
  if (beat.value.cue === 'swarm') {
    releaseSwarm()
  }
  const hold = beat.value.holdMs
  if (hold !== undefined) {
    later(next, hold)
  }
}

function next(): void {
  if (index.value < props.intro.beats.length - 1) {
    index.value++
    startBeat()
  }
  else {
    leave()
  }
}

/**
 * Le geste du joueur : il révèle la réplique en cours, puis passe à la suite.
 * Un temps qui avance seul ne se presse pas : son effet se joue en entier.
 */
function advance(): void {
  if (leaving.value) {
    return
  }
  if (!lineOut.value) {
    revealAll()
    return
  }
  if (beat.value.holdMs === undefined) {
    next()
  }
}

/**
 * Un minuteur plutôt que `transitionend`, comme la plongée de BossDoor. Parmi
 * les autres : l'écran quitté en route, `end` ne part plus.
 */
function leave(): void {
  leaving.value = true
  later(() => emit('end'), prefersReducedMotion() ? 0 : LEAVE_MS)
}

onMounted(() => {
  restart()
  startBeat()
})

onBeforeUnmount(() => {
  timers.forEach(clearTimeout)
})

useAdvanceOnEnter(advance, true, DIALOGUE_KEYS)
</script>
