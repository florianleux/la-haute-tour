<template>
  <div class="fixed inset-0 z-0 bg-white bg-cover bg-center" />
  <!-- <div class="fixed inset-0 z-0 bg-[url(/images/play-bg.webp)] bg-cover bg-center" /> -->

  <div class="relative -mt-40 z-10 mx-auto w-full max-w-4xl py-16">
    <div
      class="relative mx-auto w-full bg-[url(/images/game-card.webp)] bg-contain bg-center bg-no-repeat"
      style="aspect-ratio: 1980 / 775;"
    >
      <!-- Étage / Palier / Série : centrés dans les rubans verts, à gauche du parchemin. -->
      <p
        class="absolute left-[3%] top-[8%] w-[14%] text-right text-[0.6em] font-bold uppercase tracking-widest text-emerald-950/70">
        Étage
      </p>
      <p class="absolute left-[3%] top-[10%] w-[14%] text-right text-5xl font-bold text-emerald-950">
        {{ state.floor }}
      </p>

      <p
        class="absolute left-[3%] top-[38%] w-[14%] text-right text-[0.55em] font-bold uppercase tracking-widest text-emerald-950/70">
        Palier
      </p>

      <span class="absolute left-[3%] text-right top-[40%] w-[14%] text-emerald-950 text-3xl font-bold">{{
        state.floorSeen }}</span>
      <span class="absolute left-[3%] top-[49%] w-[14%] text-right text-emerald-950 text-[0.6em]"> /{{ state.floorTotal
      }}</span>


      <p
        class="absolute left-[3%] top-[68.5%] w-[14%] text-right text-[0.55em] font-bold uppercase tracking-widest text-emerald-950/70">
        Série
      </p>
      <p class="absolute left-[3%] top-[70.5%] w-[14%] text-right text-2xl font-bold text-emerald-950">
        {{ state.attemptSeen }}
      </p>

      <!-- Vies / Bonus / Malus : centrés dans les rubans roses, à droite du parchemin. -->
      <p
        class="absolute left-[83%] top-[8%] w-[14%] text-left text-[0.6em] font-bold uppercase tracking-widest text-rose-950/70">
        Vies
      </p>
      <p class="absolute left-[82.6%] top-[12%] w-[14%] text-left text-4xl leading-none">
        <span
          v-for="n in 3"
          :key="n"
          :class="n <= state.lives ? 'text-rose-950' : 'text-rose-950/30'"
        >♥</span>
      </p>

      <p
        class="absolute left-[83%] top-[38%] w-[14%] text-left text-[0.55em] font-bold uppercase tracking-widest text-rose-950/70"
      >
        Bonus
      </p>
      <div
        class="absolute left-[82.6%] top-[43%] flex w-[14%] justify-start gap-1.5"
      >
        <template v-if="boons.length">
          <TowerEffectPip
            v-for="(effect, i) in boons"
            :key="i"
            :effect="effect"
          />
        </template>
        <span
          v-else
          class="text-rose-950/50"
        >—</span>
      </div>

      <p
        class="absolute left-[83%] top-[68.5%] w-[14%] text-left text-[0.55em] font-bold uppercase tracking-widest text-rose-950/70"
      >
        Malus
      </p>
      <div
        class="absolute left-[82.6%] top-[72.5%] flex w-[14%] justify-start gap-1.5"
      >
        <template v-if="curses.length">
          <TowerEffectPip
            v-for="(effect, i) in curses"
            :key="i"
            :effect="effect"
          />
        </template>
        <span
          v-else
          class="text-rose-950/50"
        >—</span>
      </div>

      <div
        class="absolute left-[20%] top-[6%] flex h-[88%] w-[60%] flex-col justify-center gap-6 overflow-y-auto px-4 text-stone-800"
      >
        <p
          v-if="question.lootQuestion"
          class="text-center text-xs font-semibold uppercase tracking-wide text-emerald-700"
        >
          Question loot — réponds juste et tu ouvres un coffre.
        </p>

        <p class="text-center text-xl leading-relaxed text-amber-800">
          {{ question.statement }}
        </p>

        <input
          id="tower-answer"
          ref="field"
          :value="modelValue"
          placeholder="Votre réponse..."
          type="text"
          autocomplete="off"
          class="w-full rounded border placeholder:italic placeholder:text-md placeholder:text-[#ecd6b3] border-amber-300 bg-white px-4 py-3 text-lg text-stone-800 focus:border-amber-0 focus:outline-none"
          @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
          @keydown.enter.prevent="$emit('submit')"
        >
      </div>

      <!-- Le médaillon du chrono, à cheval sur le bord haut du cadre. -->
      <div
        class="absolute left-1/2 top-[-10%] z-20 w-[25%] -translate-x-1/2 translate-y-[-45%] bg-[url(/images/game-timer.webp)] bg-contain bg-center bg-no-repeat"
        style="aspect-ratio: 616 / 357;"
      >
        <span
          class="absolute left-1/2 top-[68%] -translate-x-1/2 -translate-y-1/2 text-3xl font-bold tabular-nums text-amber-600 pb-2"
        >
          {{ secondsLeft }}
        </span>
      </div>

      <!-- Le bouton Valider, à cheval sur le bord bas du cadre. -->
      <button
        type="button"
        :disabled="submitting"
        class="absolute bottom-0 left-1/2 z-20 flex w-[32%] pb-2 -translate-x-1/2 translate-y-1/2 items-center justify-center bg-[url(/images/submit-button.webp)] bg-contain bg-center bg-no-repeat text-3xl font-semibold uppercase tracking-wider text-amber-600 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
        style="aspect-ratio: 634 / 175;"
        @click="$emit('submit')"
      >
        Valider
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
// L'écran de question en ascension, reskin parchemin/médiéval — voulu pour cet
// écran précis et lui seul, le reste de l'app reste sur le thème sombre. Le
// cadre, le médaillon du chrono et le bouton sont des illustrations
// (public/images/), text et input positionnés en absolu, proportionnellement
// à leurs dimensions. Écrit à part de BaseButton/BaseInput, dont les classes
// portent justement l'autre thème : les reprendre ici les recouvrirait en
// ligne, ce que CLAUDE.md interdit — plus simple de sortir du système Base*
// pour cet écran isolé.
import type { GameState, ServedQuestion } from '~~/server/utils/game'
import type { EffectView } from '~~/server/utils/effects'

const props = defineProps<{
  state: GameState
  question: ServedQuestion
  modelValue: string
  secondsLeft: number | null
  submitting: boolean
  effects: EffectView[]
}>()

defineEmits<{ 'update:modelValue': [string], submit: [] }>()

const field = useTemplateRef<HTMLInputElement>('field')

onMounted(() => {
  field.value?.focus()
})

const boons = computed(() => props.effects.filter(effect => effect.face === 'boon'))
const curses = computed(() => props.effects.filter(effect => effect.face === 'curse'))
</script>
