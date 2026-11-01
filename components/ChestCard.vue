<template>
  <!-- Le cadre de l'ascension, rubans compris : le coffre s'ouvre au milieu
       de la partie, pas ailleurs. Seul le médaillon manque — aucun temps ne
       court sur un coffre. -->
  <PlayFrame
    skin="ascent"
    :reaction="reaction"
  >
    <template #ribbons>
      <StatsRibbons
        :state="state"
        :effects="effects"
      />
    </template>

    <template #action>
      <!-- Hors du panneau de texte, posé sur le cadre lui-même. Le bloc a la
           hauteur du coffre, en % de la card : `top` et `h` se règlent
           librement, et le texte déborde juste dessous, quoi qu'on choisisse.
           Mobile (cadre portrait) puis `sm:` (paysage). Transparent aux
           clics, en `!` : le `*:pointer-events-auto` de PlayFrame l'emporterait,
           et le Mimic, grossi pour son bond, couvrirait « Suivant ». -->
      <div class="pointer-events-none! absolute inset-x-0 top-[15%] flex h-[55%] flex-col items-center sm:top-[5%] sm:h-[65%]">
        <!-- Les deux coffres empilés dans la même boîte : les deux webp ont été
             rognés sur le même cadre (pieds, serrure, poignées au même pixel),
             si bien que le fondu ne fait bouger que le couvercle. C'est la
             boîte qui remue, pas une image : les deux restent calées.
             z-30 : ce qui en jaillit passe devant tout le reste de la carte —
             le texte dessous, dont la petite icône du sort (positionnée,
             donc peinte par-dessus sans lui), et le bouton (z-20) sous le Mimic
             qui saute. -->
        <div
          ref="chestBox"
          class="relative z-30 h-full shrink-0 origin-bottom"
          :class="{
            // Ouvert, le contenu est sorti : plus rien ne remue dedans.
            'motion-safe:animate-rattle': stage === 'idle' && !revealed,
            'motion-safe:animate-burst': stage === 'bursting',
            'motion-safe:animate-settle': stage === 'open' && revealed,
          }"
        >
          <img
            src="/images/chest-closed.webp"
            alt="Un coffre fermé"
            class="h-full w-auto transition-opacity duration-300"
            :class="{ 'opacity-0': revealed }"
          >
          <img
            src="/images/chest-open.webp"
            alt="Un coffre ouvert"
            class="absolute inset-0 h-full w-full transition-opacity duration-300"
            :class="looted ? 'opacity-100' : 'opacity-0'"
          >

          <!-- Le Mimic, à la place du coffre ouvert : il bondit au centre de
               l'écran, au visage du joueur, y reste suspendu, puis retombe à
               sa place. Calé sur le coffre ouvert par la caisse, commune aux
               deux images : même largeur (77 % de la boîte), même bas. Au
               bond, `--lunge` dit de combien il grossit : mesuré à son
               arrivée (`lunge`), pour qu'il fasse 90 % de la hauteur de la
               fenêtre, centré, quelle que soit sa taille. Avant la mesure,
               une valeur de repli.
               Posé à `--lunge` fois sa taille, centré au même point par les
               translate, et réduit par `animate-mimic-lunge` : Safari le
               rastérise ainsi à sa taille au bond, et il y reste net. La
               boîte porte la place, l'image l'animation : celle-ci règle
               déjà `translate`, qui écraserait celui de la place. -->
          <div
            v-if="chest.mimic"
            class="absolute z-10 -translate-x-[calc(50%-50%/var(--lunge))] -translate-y-[calc(50%-50%/var(--lunge))] [--lunge:2.4] sm:[--lunge:3]"
            :style="{ ...MIMIC_STYLE, ...lunge }"
          >
            <img
              src="/images/chest-mimic.webp"
              alt="Un mimic"
              class="w-full max-w-none motion-safe:animate-mimic-lunge motion-reduce:[transform:scale(calc(1/var(--lunge)))]"
            >
          </div>

          <!-- L'éclair, centré sur la fente entre couvercle et caisse (48% de
               la hauteur de l'image) : il éblouit pendant le fondu, qui se
               fait dessous. Seulement à l'ouverture, pas sur un coffre déjà
               ouvert quand l'écran arrive. -->
          <div
            v-if="stage === 'open' && looted"
            :style="{ top: percent(SLIT_TOP) }"
            class="absolute left-1/2 aspect-square w-[130%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,white_0%,rgb(254_243_199/0.9)_30%,transparent_70%)] opacity-0 motion-safe:animate-dazzle"
          />

          <!-- Le sort pioché, qui sort du coffre et flotte au-dessus. Deux
               boîtes parce que deux animations de `transform` sur le même
               élément s'écrasent : l'extérieure le fait jaillir de la fente,
               l'intérieure le fait léviter. L'ombre portée sombre le détache
               du coffre doré, le halo doré par-dessus le garde lumineux.
               @container : les étincelles qui en partent comptent leur course
               en cqw, donc en largeur de médaillon.
               Posée à `--peak` fois sa taille (celle de la pause), centre
               remonté au même point par le translate, et réduite par
               `animate-emerge` : Safari la rastérise à cette taille, et le
               médaillon reste net quand il grossit. D'où aussi l'ombre en px
               multipliée par `--peak`. -->
          <!-- À l'ouverture, c'est l'apparition (ItemReveal, plus bas) qui le
               fait jaillir ; il n'est là qu'une fois elle refermée, posé à sa
               place sans rejouer son jaillissement. -->
          <div
            v-if="(chest.spell && spellImage(chest.spell) || keyItem) && (stage !== 'open' || lootSeen)"
            :style="{ width: `calc(${percent(SPELL_WIDTH)} * var(--peak))` }"
            class="absolute left-1/2 top-[0%] -translate-x-1/2 -translate-y-[calc(50%-50%/var(--peak))] [--peak:4] @container"
            :class="lootSeen
              ? '[transform:scale(calc(1/var(--peak)))] motion-safe:animate-fade-in'
              : 'motion-safe:animate-emerge motion-reduce:[transform:scale(calc(1/var(--peak)))]'"
          >
            <!-- Le climax, à l'apogée du jaillissement (entre 0,45 et 1,4 s,
                 quand le médaillon tient à quatre fois sa taille) : des rayons
                 tournent derrière lui, un reflet le traverse, une étoile
                 s'allume sur son bord. Les trois durent 2,35 s comme
                 `animate-emerge` et démarrent avec lui : leurs pourcentages
                 tombent donc sur les mêmes instants. Ils grossissent avec le
                 médaillon, d'où leur place dans cette boîte. -->
            <RaysHalo
              v-if="!lootSeen"
              color="rgb(254 243 199 / 0.9)"
              class="w-[230%] opacity-0 motion-safe:animate-rays"
            />

            <div class="relative motion-safe:animate-float">
              <!-- La clé du boss sort du coffre comme un sort, sans médaillon. -->
              <img
                v-if="keyItem"
                :src="keyItem.image"
                :alt="keyItem.name"
                class="w-full"
              >
              <SpellMedallion
                v-else-if="chest.spell"
                :spell="chest.spell"
                face="mixed"
                :alt="spellLabel(chest.spell)"
                class="w-full"
                shadow-class="shadow-[0_calc(6px*var(--peak))_calc(10px*var(--peak))_rgb(0_0_0/0.5),0_0_calc(12px*var(--peak))_#fde68a]"
              />
              <div
                v-if="!lootSeen && chest.spell"
                class="absolute inset-[5%] overflow-hidden rounded-full"
              >
                <div class="absolute inset-0 bg-[linear-gradient(110deg,transparent_35%,rgb(255_255_255/0.85)_50%,transparent_65%)] motion-safe:animate-sheen motion-reduce:hidden" />
              </div>
              <template v-if="!lootSeen">
                <SparkleStar
                  glow="#fef3c7"
                  class="left-[62%] top-[-4%] w-[38%] opacity-0 motion-safe:animate-glint"
                />
                <SparkleStar
                  glow="#fef3c7"
                  class="left-[4%] top-[62%] w-[22%] opacity-0 motion-safe:animate-glint [animation-delay:0.06s]"
                />
              </template>
              <!-- Le scintillement autour du médaillon, une fois posé. -->
              <SparkleField
                :sparks="SPELL_SPARKS"
                glow="#fef3c7"
              />
            </div>

            <!-- La gerbe, au moment où il retombe à sa place : les étincelles
                 partent du centre dans toutes les directions, une seule fois. -->
            <SparkleSpray
              v-if="!lootSeen"
              :sparks="SPELL_SPRAY"
              glow="#fde68a"
            />
          </div>

          <!-- Les étincelles, dans le couvercle ouvert et juste au-dessus. -->
          <SparkleField
            v-if="looted"
            :sparks="SPARKS"
            glow="#fde68a"
          />
        </div>

        <!-- @container à la largeur du panneau de PlayFrame : les tailles de
             PlayText sont en cqw, mesurées sur ce panneau. Sans lui, elles se
             mesureraient sur la card entière et le texte grossirait. -->
        <div class="pointer-events-auto @container w-[84%] shrink-0 text-center sm:w-[52%]">
          <PlayText
            v-if="!chest.opened && refused"
            role="recall"
            class="font-semibold text-rose-700"
          >
            Le coffre résiste. Réessaie.
          </PlayText>
          <PlayText
            v-else-if="!chest.opened"
            role="recall"
            class="text-amber-800"
          >
            Ce coffre rutilant doit renfermer quelque chose de précieux...
          </PlayText>
          <!-- Le Mimic a déjà basculé la partie en attente : « Suivant » mène au
               poster, qui ne le rappelle pas. Voir specs/bonus.md#coffre-et-mimic. -->
          <PlayText
            v-else-if="chest.mimic"
            role="recall"
            class="font-semibold text-rose-700"
          >
            Oh non, ce coffre contenait un mimic qui t'a attaqué ! Tu perds toutes tes vies.
          </PlayText>
          <PlayText
            v-else-if="chest.spell"
            role="recall"
            class="font-semibold text-emerald-700"
          >
            Le coffre contenait <strong><SpellMention :subject="chest.spell" /></strong>. Il rejoint ton Grimoire.
          </PlayText>
          <!-- La clé ne rejoint jamais le Grimoire : une clé n'est pas un sort.
               Voir specs/boss.md#obtention-de-la-clé. -->
          <PlayText
            v-else-if="keyItem"
            role="recall"
            class="font-semibold text-emerald-700"
          >
            Le coffre contenait <strong>{{ keyDoor?.keyName }}</strong>. Elle rejoint ton Inventaire.
          </PlayText>
        </div>
      </div>

      <!-- Le sort sorti du coffre : il saute de la fente du coffre au centre
           de l'écran, et s'y montre pour lui seul jusqu'au OK. Seulement à
           l'ouverture, pas sur un coffre déjà ouvert quand l'écran arrive. -->
      <ItemReveal
        v-if="stage === 'open' && looted && keyItem && !lootSeen"
        :label="keyItem.name"
        :image="keyItem.image"
        :from="spellFrom"
        @close="lootSeen = true"
      />
      <ItemReveal
        v-else-if="stage === 'open' && looted && chest.spell && !lootSeen"
        :label="spellLabel(chest.spell)"
        :from="spellFrom"
        @close="lootSeen = true"
      >
        <SpellMedallion
          :spell="chest.spell"
          face="mixed"
          class="size-full"
          shadow-class="shadow-[0_6px_10px_rgb(0_0_0/0.5),0_0_12px_#fde68a]"
        />
      </ItemReveal>

      <BaseCardButton
        v-if="!chest.opened"
        label="OUVRIR"
        anchor="card-bottom"
        :disabled="opening || stage !== 'idle'"
        @click="burst"
      />
      <!-- playView en donne toujours un une fois le coffre ouvert. -->
      <BaseCardButton
        v-else-if="action"
        :label="action.label"
        anchor="card-bottom"
        :disabled="advancing"
        @click="$emit('advance')"
      />
    </template>
  </PlayFrame>
</template>

<script setup lang="ts">
// L'ouverture du coffre, à part du verdict qui l'a annoncée : cliquer
// « Suivant » sur ResultCard mène ici, « OUVRIR » déclenche le tirage
// serveur, et une fois révélé, ce même bouton fait avancer la partie.
// Voir specs/bonus.md#coffre-et-mimic.
//
// « OUVRIR » ne part pas tout de suite : le coffre tremble d'abord de plus en
// plus fort, puis s'ouvre en fondu, et c'est seulement là que le tirage est
// demandé — le résultat ne peut pas arriver avant que le coffre soit ouvert.
import type { PlayAction } from '~~/utils/phase'
import type { ChestView, GameState } from '~~/server/utils/game'
import type { EffectView } from '~~/server/utils/effects'

const props = defineProps<{
  state: GameState
  effects: EffectView[]
  chest: ChestView
  /** L'action suivante une fois le coffre ouvert — null tant qu'il ne l'est pas.
   *  Voir utils/phase.ts (playView). */
  action: PlayAction | null
  opening: boolean
  advancing: boolean
}>()

const emit = defineEmits<{ open: [], advance: [] }>()

/** La durée de `animate-burst` (assets/css/main.css) : les deux bougent ensemble. */
const BURST_MS = 1200

/**
 * Les étincelles, en % de la boîte du coffre ouvert : réparties dans le
 * couvercle (de 15 à 50% de haut, entre ses deux montants), délais étalés sur
 * le cycle de `animate-sparkle` pour qu'elles ne s'allument pas ensemble.
 */
const SPARKS = [
  { left: '28%', top: '30%', size: '6%', delay: '0s' },
  { left: '45%', top: '18%', size: '8%', delay: '0.5s' },
  { left: '62%', top: '26%', size: '5%', delay: '1.1s' },
  { left: '36%', top: '44%', size: '4%', delay: '0.8s' },
  { left: '55%', top: '40%', size: '7%', delay: '0.2s' },
  { left: '70%', top: '15%', size: '4%', delay: '1.4s' },
  { left: '22%', top: '16%', size: '5%', delay: '0.9s' },
  { left: '50%', top: '30%', size: '3%', delay: '1.2s' },
]

/**
 * Le scintillement autour du médaillon, en % de sa largeur. Les délais partent
 * de 1,75 s : avant, il jaillit encore, et une étincelle grossie quatre
 * fois avec lui ferait tache.
 */
const SPELL_SPARKS = [
  { left: '-6%', top: '8%', size: '12%', delay: '1.75s' },
  { left: '90%', top: '2%', size: '9%', delay: '2.25s' },
  { left: '96%', top: '58%', size: '11%', delay: '1.95s' },
  { left: '-10%', top: '66%', size: '8%', delay: '2.55s' },
  { left: '44%', top: '-14%', size: '10%', delay: '2.85s' },
  { left: '70%', top: '92%', size: '8%', delay: '2.1s' },
]

/**
 * La gerbe : dix étincelles en étoile autour du centre, une sur deux plus
 * loin et plus grosse pour que le cercle ne soit pas trop régulier. Lancées
 * juste avant que le médaillon ne retombe à sa place (vers 1,63 s de
 * `animate-emerge`). Distances en cqw, donc en largeur de médaillon.
 */
const SPELL_SPRAY = Array.from({ length: 10 }, (_, index) => {
  const angle = ((index * 36 + (index % 2) * 14) * Math.PI) / 180
  const distance = index % 2 ? 70 : 100

  return {
    dx: `${Math.round(Math.cos(angle) * distance)}cqw`,
    dy: `${Math.round(Math.sin(angle) * distance)}cqw`,
    size: index % 2 ? '9%' : '14%',
    delay: `${(1.57 + (index % 3) * 0.04).toFixed(2)}s`,
  }
})

const stage = ref<'idle' | 'bursting' | 'open'>('idle')

/** La porte de l'étage, dont le coffre donne la clé : son nom et son image. Null sur tout autre coffre. */
const keyDoor = computed(() => props.chest.key ? bossStageOf(props.state.floor).door : null)
const keyItem = computed(() => keyDoor.value?.keyItem ?? null)
/** Le sort ou la clé obtenus ont été vus, et leur apparition refermée par OK. */
const lootSeen = ref(false)

/**
 * La géométrie du coffre, en part de sa boîte : le gabarit s'en sert pour
 * poser les choses, et les mesures du saut du sort et du bond du Mimic pour
 * les retrouver à l'écran. Un seul endroit à changer quand une image bouge.
 */
/** La fente entre couvercle et caisse, en part de la hauteur : l'éclair y naît, le sort en jaillit. */
const SLIT_TOP = 0.48
/** La largeur du sort posé au-dessus du coffre ouvert. */
const SPELL_WIDTH = 0.3
/** La place du Mimic, calé sur le coffre ouvert par la caisse : même largeur, même bas. */
const MIMIC_SLOT = { left: 0.103, top: 0.041, width: 0.77 }
/** Les proportions du Mimic (public/images/chest-mimic.webp, 1275×1377). */
const MIMIC_RATIO = 1377 / 1275

function percent(part: number): string {
  return `${part * 100}%`
}

/** Le Mimic à sa place, posé à `--lunge` fois sa taille (voir le gabarit). */
const MIMIC_STYLE = {
  left: percent(MIMIC_SLOT.left),
  top: percent(MIMIC_SLOT.top),
  width: `calc(${percent(MIMIC_SLOT.width)} * var(--lunge))`,
}

const chestBox = useTemplateRef<HTMLElement>('chestBox')
/**
 * Le coffre à l'écran, mesuré quand il s'ouvre (le tremblement fini), ou au
 * montage s'il l'est déjà : le saut du sort et le bond du Mimic en partent.
 */
const openedBox = ref<DOMRect>()

onMounted(() => {
  if (props.chest.opened) {
    openedBox.value = chestBox.value!.getBoundingClientRect()
  }
})

/** D'où le sort saute vers son apparition : la fente, à la largeur qu'il a posé au-dessus. */
const spellFrom = computed(() => {
  const box = openedBox.value
  return box && { x: box.left + box.width / 2, y: box.top + box.height * SLIT_TOP, width: box.width * SPELL_WIDTH }
})
/** Sa hauteur à l'apex, en part de la fenêtre. */
const LUNGE_HEIGHT = 0.9
/** Le grossissement de son suspens, au plus haut (`scale(1.06)` d'`animate-mimic-lunge`). */
const LUNGE_PEAK = 1.06

/**
 * Le bond : `--lunge`, de combien il grossit pour faire 90 % de la hauteur
 * de la fenêtre au plus fort de son suspens, et (`--lunge-dx`, `--lunge-dy`),
 * de sa place dans le coffre (MIMIC_SLOT) au centre de la fenêtre. Voir
 * `animate-mimic-lunge`.
 */
const lunge = computed(() => {
  const box = openedBox.value
  if (!box || !props.chest.mimic) {
    return undefined
  }
  const height = box.width * MIMIC_SLOT.width * MIMIC_RATIO
  const x = box.left + box.width * (MIMIC_SLOT.left + MIMIC_SLOT.width / 2)
  const y = box.top + box.height * MIMIC_SLOT.top + height / 2
  return {
    '--lunge': ((LUNGE_HEIGHT * innerHeight) / (height * LUNGE_PEAK)).toFixed(2),
    '--lunge-dx': `${Math.round(innerWidth / 2 - x)}px`,
    '--lunge-dy': `${Math.round(innerHeight / 2 - y)}px`,
  }
})
/** Le serveur n'a pas ouvert le coffre : on le dit, au lieu d'un échec muet. */
const refused = ref(false)
// Le coffre ne s'ouvre qu'avec la réponse du serveur, pas à la fin du
// tremblement : ouvert plus tôt, il montrerait un trésor — fondu, éclair,
// étincelles — avant que le Mimic n'arrive le remplacer.
const revealed = computed(() => props.chest.opened)
/** Ouvert sur un trésor : le coffre ouvert, son éclair et ses étincelles. Pas sur un Mimic. */
const looted = computed(() => revealed.value && !props.chest.mimic)

/**
 * Le cadre suit le coffre : il tremble avec lui (`quake`), rebondit quand il
 * s'ouvre sur un trésor (`pop`), encaisse le Mimic (`mauled`). Un coffre déjà
 * ouvert à l'arrivée de l'écran ne fait rien rebondir.
 */
const reaction = computed(() => {
  if (props.chest.mimic) {
    return 'mauled'
  }
  if (stage.value === 'bursting') {
    return 'quake'
  }
  return stage.value === 'open' && looted.value ? 'pop' : undefined
})

// Un minuteur plutôt que `animationend` : sous « réduire les animations »,
// `motion-safe:` retire l'animation et l'événement ne viendrait jamais.
function burst(): void {
  refused.value = false
  stage.value = 'bursting'
  setTimeout(() => {
    openedBox.value = chestBox.value!.getBoundingClientRect()
    stage.value = 'open'
    emit('open')
  }, BURST_MS)
}

// La requête est finie et le coffre est toujours fermé : elle a échoué (réseau,
// serveur). Le coffre se referme et OUVRIR redevient cliquable — sans ça, il
// restait affiché ouvert, bouton éteint, et seul un rechargement sortait le
// joueur de là. Le message d'échec de pages/index.vue ne s'affiche pas sur cet
// écran, d'où le sien.
watch(() => props.opening, (opening, wasOpening) => {
  if (wasOpening && !opening && !props.chest.opened) {
    stage.value = 'idle'
    refused.value = true
  }
})

// Un coffre refermé (le banc de test en resert un) repart de zéro.
watch(() => props.chest.opened, (opened) => {
  if (!opened) {
    stage.value = 'idle'
    lootSeen.value = false
  }
})
</script>
