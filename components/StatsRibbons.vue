<template>
  <!-- Étage / Palier / Série : centrés dans les rubans verts, à gauche du parchemin. -->
  <p class="absolute left-[3%] top-[8%] w-[14%] text-right text-[1.1cqw] font-bold uppercase tracking-widest text-emerald-950/70">
    Étage
  </p>
  <p class="absolute left-[3%] top-[7%] w-[14%] text-right text-[5.4cqw] font-bold text-emerald-950">
    {{ state.floor }}
  </p>

  <p class="absolute left-[3%] top-[38%] w-[14%] text-right text-[1cqw] font-bold uppercase tracking-widest text-emerald-950/70">
    Palier
  </p>

  <span class="absolute left-[3%] top-[39%] w-[14%] text-right text-[3.3cqw] font-bold text-emerald-950">{{ state.floorSeen }}</span>
  <span class="absolute left-[3%] top-[49%] w-[14%] text-right text-[1.1cqw] text-emerald-950">/{{ state.floorTotal }}</span>

  <p class="absolute left-[3%] top-[68.5%] w-[14%] text-right text-[1cqw] font-bold uppercase tracking-widest text-emerald-950/70">
    Série
  </p>
  <p class="absolute left-[3%] top-[70.5%] w-[14%] text-right text-[2.7cqw] font-bold text-emerald-950">
    {{ state.attemptSeen }}
  </p>

  <!-- Vies / Bonus / Malus : centrés dans les rubans roses, à droite du parchemin. -->
  <p class="absolute left-[83%] top-[8%] w-[14%] text-left text-[1.1cqw] font-bold uppercase tracking-widest text-rose-950/70">
    Vies
  </p>
  <p class="absolute left-[82.6%] top-[12%] w-[14%] text-left text-[4cqw] leading-none">
    <span
      v-for="n in 3"
      :key="n"
      :class="n <= state.lives ? 'text-rose-950' : 'text-rose-950/30'"
    >♥</span>
  </p>

  <p class="absolute left-[83%] top-[38%] w-[14%] text-left text-[1cqw] font-bold uppercase tracking-widest text-rose-950/70">
    Bonus
  </p>
  <div class="absolute left-[82.6%] top-[43%] flex w-[14%] justify-start gap-1.5">
    <template v-if="boons.length">
      <EffectPip
        v-for="(effect, i) in boons"
        :key="i"
        :effect="effect"
      />
    </template>
  </div>

  <p class="absolute left-[83%] top-[68.5%] w-[14%] text-left text-[1cqw] font-bold uppercase tracking-widest text-rose-950/70">
    Malus
  </p>
  <div class="absolute left-[82.6%] top-[72.5%] flex w-[14%] justify-start gap-1.5">
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
// choix (container-type sur l'ancêtre commun).
import type { GameState } from '~~/server/utils/game'
import type { EffectView } from '~~/server/utils/effects'

const props = defineProps<{
  state: GameState
  effects: EffectView[]
}>()

const boons = computed(() => props.effects.filter(effect => effect.face === 'boon'))
const curses = computed(() => props.effects.filter(effect => effect.face === 'curse'))
</script>
