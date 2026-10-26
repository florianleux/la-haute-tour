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
           Mobile (cadre portrait) puis `sm:` (paysage). -->
      <div class="pointer-events-none absolute inset-x-0 top-[15%] flex h-[55%] flex-col items-center sm:top-[5%] sm:h-[65%]">
        <!-- Les deux coffres empilés dans la même boîte : les deux webp ont été
             rognés sur le même cadre (pieds, serrure, poignées au même pixel),
             si bien que le fondu ne fait bouger que le couvercle. C'est la
             boîte qui remue, pas une image : les deux restent calées.
             z-30 : ce qui en jaillit passe devant tout le reste de la carte —
             le texte dessous, dont la petite icône du sort (positionnée,
             donc peinte par-dessus sans lui), et le bouton (z-20) sous le Mimic
             qui saute. -->
        <div
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
               bond, `--lunge` dit de combien il grossit — moins en mobile,
               où le cadre portrait le fait déjà plus grand.
               Posé à `--lunge` fois sa taille, centré au même point par les
               translate, et réduit par `animate-mimic-lunge` : Safari le
               rastérise ainsi à sa taille au bond, et il y reste net. La
               boîte porte la place, l'image l'animation : celle-ci règle
               déjà `translate`, qui écraserait celui de la place. -->
          <div
            v-if="chest.mimic"
            class="absolute left-[10.3%] top-[4.1%] z-10 w-[calc(77%*var(--lunge))] -translate-x-[calc(50%-50%/var(--lunge))] -translate-y-[calc(50%-50%/var(--lunge))] [--lunge:2.4] sm:[--lunge:3]"
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
            class="absolute left-1/2 top-[48%] aspect-square w-[130%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,white_0%,rgb(254_243_199/0.9)_30%,transparent_70%)] opacity-0 motion-safe:animate-dazzle"
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
          <div
            v-if="chest.spell && spellImage(chest.spell)"
            class="absolute left-1/2 top-[0%] w-[calc(30%*var(--peak))] -translate-x-1/2 -translate-y-[calc(50%-50%/var(--peak))] [--peak:4] @container motion-safe:animate-emerge motion-reduce:[transform:scale(calc(1/var(--peak)))]"
          >
            <!-- Le climax, à l'apogée du jaillissement (entre 0,45 et 1,4 s,
                 quand le médaillon tient à quatre fois sa taille) : des rayons
                 tournent derrière lui, un reflet le traverse, une étoile
                 s'allume sur son bord. Les trois durent 2,35 s comme
                 `animate-emerge` et démarrent avec lui : leurs pourcentages
                 tombent donc sur les mêmes instants. Ils grossissent avec le
                 médaillon, d'où leur place dans cette boîte. -->
            <div class="absolute left-1/2 top-1/2 aspect-square w-[230%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[repeating-conic-gradient(rgb(254_243_199/0.9)_0deg_8deg,transparent_8deg_24deg)] opacity-0 [mask-image:radial-gradient(circle,black_15%,transparent_68%)] motion-safe:animate-rays" />

            <div class="relative motion-safe:animate-float">
              <SpellMedallion
                :spell="chest.spell"
                face="mixed"
                :alt="spellLabel(chest.spell)"
                class="w-full"
                shadow-class="shadow-[0_calc(6px*var(--peak))_calc(10px*var(--peak))_rgb(0_0_0/0.5),0_0_calc(12px*var(--peak))_#fde68a]"
              />
              <div class="absolute inset-[5%] overflow-hidden rounded-full">
                <div class="absolute inset-0 bg-[linear-gradient(110deg,transparent_35%,rgb(255_255_255/0.85)_50%,transparent_65%)] motion-safe:animate-sheen motion-reduce:hidden" />
              </div>
              <SparkleStar
                glow="#fef3c7"
                class="left-[62%] top-[-4%] w-[38%] opacity-0 motion-safe:animate-glint"
              />
              <SparkleStar
                glow="#fef3c7"
                class="left-[4%] top-[62%] w-[22%] opacity-0 motion-safe:animate-glint [animation-delay:0.06s]"
              />
              <!-- Le scintillement autour du médaillon, une fois posé. -->
              <SparkleField
                :sparks="SPELL_SPARKS"
                glow="#fef3c7"
              />
            </div>

            <!-- La gerbe, au moment où il retombe à sa place : les étincelles
                 partent du centre dans toutes les directions, une seule fois. -->
            <SparkleSpray
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
        </div>
      </div>

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
  }
})
</script>
