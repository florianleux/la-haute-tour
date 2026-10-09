<template>
  <!-- Le cadre de l'ascension, rubans compris : le coffre s'ouvre au milieu
       de la partie, pas ailleurs. Seul le médaillon manque — aucun temps ne
       court sur un coffre. -->
  <PlayFrame skin="ascent">
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
             boîte qui remue, pas une image : les deux restent calées. -->
        <div
          class="relative h-full shrink-0 origin-bottom"
          :class="{
            // Ouvert, le contenu est sorti : plus rien ne remue dedans.
            'motion-safe:animate-rattle': stage === 'idle' && !revealed,
            'motion-safe:animate-burst': stage === 'bursting',
            'motion-safe:animate-settle': stage === 'open',
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
            :class="revealed ? 'opacity-100' : 'opacity-0'"
          >

          <!-- L'éclair, centré sur la fente entre couvercle et caisse (48% de
               la hauteur de l'image) : il éblouit pendant le fondu, qui se
               fait dessous. Seulement à l'ouverture, pas sur un coffre déjà
               ouvert quand l'écran arrive. -->
          <div
            v-if="stage === 'open'"
            class="absolute left-1/2 top-[48%] aspect-square w-[130%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,white_0%,rgb(254_243_199/0.9)_30%,transparent_70%)] opacity-0 motion-safe:animate-dazzle"
          />

          <!-- Le sort pioché, qui sort du coffre et flotte au-dessus. Deux
               boîtes parce que deux animations de `transform` sur le même
               élément s'écrasent : l'extérieure le fait monter de la fente,
               l'intérieure le fait léviter. L'ombre portée sombre le détache
               du coffre doré, le halo doré par-dessus le garde lumineux. -->
          <div
            v-if="chest.spell && spellImage(chest.spell)"
            class="absolute left-1/2 top-[0%] w-[30%] -translate-x-1/2 motion-safe:animate-emerge"
          >
            <img
              :src="spellImage(chest.spell)!"
              :alt="spellLabel(chest.spell)"
              class="w-full motion-safe:animate-float [filter:drop-shadow(0_6px_10px_rgb(0_0_0/0.5))_drop-shadow(0_0_12px_#fde68a)]"
            >
          </div>

          <!-- Les étincelles, dans le couvercle ouvert et juste au-dessus. Le
               halo doré vient du parent : un `drop-shadow` sur l'étoile
               elle-même serait rogné par son propre clip-path. -->
          <div
            v-if="revealed"
            class="absolute inset-0 drop-shadow-[0_0_3px_#fde68a]"
          >
            <span
              v-for="(spark, index) in SPARKS"
              :key="index"
              class="absolute aspect-square bg-white opacity-0 [clip-path:polygon(50%_0,61%_39%,100%_50%,61%_61%,50%_100%,39%_61%,0_50%,39%_39%)] motion-safe:animate-sparkle"
              :style="{ left: spark.left, top: spark.top, width: spark.size, animationDelay: spark.delay }"
            />
          </div>
        </div>

        <!-- @container à la largeur du panneau de PlayFrame : les tailles de
             PlayText sont en cqw, mesurées sur ce panneau. Sans lui, elles se
             mesureraient sur la card entière et le texte grossirait. -->
        <div class="@container w-[84%] shrink-0 text-center sm:w-[52%]">
          <PlayText
            v-if="!chest.opened"
            role="recall"
            class="text-amber-800"
          >
            Ce coffre rutilant doit renfermer quelque chose de précieux...
          </PlayText>
          <!-- Mêmes deux messages que sur l'écran d'attente (WaitCard, qui les
               rend sur son poster) : chaque écran reskiné porte sa copie, faute
               d'un composant partagé qui survivrait aux deux habillages.
               Voir specs/bonus.md#coffre-et-mimic. -->
          <PlayText
            v-else-if="chest.mimic"
            role="recall"
            class="font-semibold text-rose-700"
          >
            Un mimic. Aucun objet, et toutes tes vies d'un coup.
          </PlayText>
          <PlayText
            v-else-if="chest.spell"
            role="recall"
            class="font-semibold text-emerald-700"
          >
            Le coffre contenait <strong>{{ spellLabel(chest.spell) }}</strong>. Il rejoint ton inventaire.
          </PlayText>
        </div>
      </div>

      <CardButton
        v-if="!chest.opened"
        label="OUVRIR"
        anchor="card-bottom"
        :disabled="opening || stage !== 'idle'"
        @click="burst"
      />
      <CardButton
        v-else
        :label="action ?? 'Suivant'"
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
import type { ChestView, GameState } from '~~/server/utils/game'
import type { EffectView } from '~~/server/utils/effects'

const props = defineProps<{
  state: GameState
  effects: EffectView[]
  chest: ChestView
  /** L'action suivante une fois le coffre ouvert — null tant qu'il ne l'est pas. */
  action: string | null
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

const stage = ref<'idle' | 'bursting' | 'open'>('idle')
const revealed = computed(() => stage.value === 'open' || props.chest.opened)

// Un minuteur plutôt que `animationend` : sous « réduire les animations »,
// `motion-safe:` retire l'animation et l'événement ne viendrait jamais.
function burst(): void {
  stage.value = 'bursting'
  setTimeout(() => {
    stage.value = 'open'
    emit('open')
  }, BURST_MS)
}

// Un coffre refermé (le banc de test en resert un) repart de zéro.
watch(() => props.chest.opened, (opened) => {
  if (!opened) {
    stage.value = 'idle'
  }
})
</script>
