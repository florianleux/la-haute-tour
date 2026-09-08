<template>
  <!-- Étage / Palier / Série. Desktop : rubans verts à gauche du parchemin.
       Mobile (mobile-play-card.webp) : le ruban vert pend sous le cadre plutôt
       qu'à côté — les trois chiffres s'y empilent, plus serrés et centrés. -->
  <p
    class="absolute left-[5%] top-[75%] w-[24%] text-center text-[3.4cqw] font-bold uppercase tracking-widest text-emerald-950/70 sm:left-[3%] sm:top-[8%] sm:w-[14%] sm:text-right sm:text-[1.1cqw]">
    Étage
  </p>
  <p
    class="absolute left-[5%] top-[76%] w-[24%] text-center text-[7cqw] font-bold text-emerald-950 sm:left-[3%] sm:top-[7%] sm:w-[14%] sm:text-right sm:text-[5.4cqw]">
    {{ state.floor }}
  </p>

  <p
    class="absolute left-[5%] top-[81%] w-[24%] text-center text-[3.4cqw] font-bold uppercase tracking-widest text-emerald-950/70 sm:left-[3%] sm:top-[38%] sm:w-[14%] sm:text-right sm:text-[1cqw]">
    Palier
  </p>

  <span
    class="absolute left-[5%] top-[82%] w-[24%] text-center text-[7cqw] font-bold text-emerald-950 sm:left-[3%] sm:top-[39%] sm:w-[14%] sm:text-right sm:text-[3.3cqw]"
  >{{ state.floorSeen }}</span>
  <span
    class=" invisible sm:visible  sm:absolute left-[19%] top-[83%] w-[10%] text-left text-[2.4cqw] text-emerald-950 sm:left-[3%] sm:top-[49%] sm:w-[14%] sm:text-right sm:text-[1.1cqw]"
  >/{{ state.floorTotal }}</span>

  <p
    class="absolute left-[5%] top-[87%] w-[24%] text-center text-[3.4cqw] font-bold uppercase tracking-widest text-emerald-950/70 sm:left-[3%] sm:top-[68.5%] sm:w-[14%] sm:text-right sm:text-[1cqw]">
    Série
  </p>
  <p
    class="absolute left-[5%] top-[88%] w-[24%] text-center text-[7cqw] font-bold text-emerald-950 sm:left-[3%] sm:top-[69%]  sm:w-[14%] sm:text-right sm:text-[3.3cqw]">
    {{ state.attemptSeen }}
  </p>

  <!-- Vies / Bonus / Malus. Desktop : rubans roses à droite du parchemin.
       Mobile : ruban rose sous le cadre, symétrique du vert. -->
  <p
    class="absolute left-[71%] top-[75%] w-[24%] text-center text-[3.4cqw] font-bold uppercase tracking-widest text-rose-950/70 sm:left-[83%] sm:top-[8%] sm:w-[14%] sm:text-left sm:text-[1.1cqw]">
    Vies
  </p>
  <p
    class="absolute left-[71%] top-[77.5%] w-[24%] text-center text-[5cqw] sm:text-[4cqw] leading-none sm:left-[82.6%] sm:top-[12%] sm:w-[14%] sm:text-left sm:text-[4cqw]">
    <span
      v-for="n in 3"
      :key="n"
      :class="n <= state.lives ? 'text-rose-950' : 'text-rose-950/30'"
    >♥</span>
  </p>

  <p
    class="absolute left-[71%] top-[81%] w-[24%] text-center text-[3.4cqw] font-bold uppercase tracking-widest text-rose-950/70 sm:left-[83%] sm:top-[38%] sm:w-[14%] sm:text-left sm:text-[1cqw]">
    Bonus
  </p>
  <div
    class="absolute left-[71%] top-[83.5%] flex w-[24%] justify-center gap-1.5 sm:left-[82.6%] sm:top-[43%] sm:w-[14%] sm:justify-start"
  >
    <template v-if="boons.length">
      <EffectPip
        v-for="(effect, i) in boons"
        :key="i"
        :effect="effect"
      />
    </template>
  </div>

  <p
    class="absolute left-[71%] top-[87%] w-[24%] text-center text-[3.4cqw] font-bold uppercase tracking-widest text-rose-950/70 sm:left-[83%] sm:top-[68.5%] sm:w-[14%] sm:text-left sm:text-[1cqw]">
    Malus
  </p>
  <div
    class="absolute left-[71%] top-[90%] flex w-[24%] justify-center gap-1.5 sm:left-[82.6%] sm:top-[72.5%] sm:w-[14%] sm:justify-start"
  >
    <template v-if="curses.length">
      <EffectPip
        v-for="(effect, i) in curses"
        :key="i"
        :effect="effect"
      />
    </template>
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
}>()

const boons = computed(() => props.effects.filter(effect => effect.face === 'boon'))
const curses = computed(() => props.effects.filter(effect => effect.face === 'curse'))
</script>
