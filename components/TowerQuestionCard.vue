<template>
  <div class="fixed inset-0 z-0 bg-white bg-cover bg-center" />
  <!-- <div class="fixed inset-0 z-0 bg-[url(/images/play-bg.webp)] bg-cover bg-center" /> -->

  <div class="relative -mt-40 z-10 mx-auto w-full max-w-4xl py-16">
    <!-- container-type: inline-size fait de la largeur de cette carte l'unité de
         référence (cqw) pour tout ce qu'elle contient. bg-contain rétrécit le
         cadre sous ce seuil comme au-dessus ; sans cqw, le texte gardait sa
         taille en px et se détachait de ses rubans dès que le viewport rétrécit. -->
    <div
      class="relative mx-auto w-full bg-[url(/images/game-card.webp)] bg-contain bg-center bg-no-repeat"
      style="aspect-ratio: 1980 / 775; container-type: inline-size;"
    >
      <!-- Étage / Palier / Série : centrés dans les rubans verts, à gauche du parchemin. -->
      <p
        class="absolute left-[3%] top-[8%] w-[14%] text-right text-[1.1cqw] font-bold uppercase tracking-widest text-emerald-950/70">
        Étage
      </p>
      <p class="absolute left-[3%] top-[7%] w-[14%] text-right text-[5.4cqw] font-bold text-emerald-950">
        {{ state.floor }}
      </p>

      <p
        class="absolute left-[3%] top-[38%] w-[14%] text-right text-[1cqw] font-bold uppercase tracking-widest text-emerald-950/70">
        Palier
      </p>

      <span class="absolute left-[3%] top-[39%] w-[14%] text-right text-[3.3cqw] font-bold text-emerald-950">{{
        state.floorSeen }}</span>
      <span class="absolute left-[3%] top-[49%] w-[14%] text-right text-[1.1cqw] text-emerald-950">/{{ state.floorTotal
      }}</span>

      <p
        class="absolute left-[3%] top-[68.5%] w-[14%] text-right text-[1cqw] font-bold uppercase tracking-widest text-emerald-950/70">
        Série
      </p>
      <p class="absolute left-[3%] top-[70.5%] w-[14%] text-right text-[2.7cqw] font-bold text-emerald-950">
        {{ state.attemptSeen }}
      </p>

      <!-- Vies / Bonus / Malus : centrés dans les rubans roses, à droite du parchemin. -->
      <p
        class="absolute left-[83%] top-[8%] w-[14%] text-left text-[1.1cqw] font-bold uppercase tracking-widest text-rose-950/70">
        Vies
      </p>
      <p class="absolute left-[82.6%] top-[12%] w-[14%] text-left text-[4cqw] leading-none">
        <span
          v-for="n in 3"
          :key="n"
          :class="n <= state.lives ? 'text-rose-950' : 'text-rose-950/30'"
        >♥</span>
      </p>

      <p
        class="absolute left-[83%] top-[38%] w-[14%] text-left text-[1cqw] font-bold uppercase tracking-widest text-rose-950/70">
        Bonus
      </p>
      <div class="absolute left-[82.6%] top-[43%] flex w-[14%] justify-start gap-1.5">
        <template v-if="boons.length">
          <TowerEffectPip
            v-for="(effect, i) in boons"
            :key="i"
            :effect="effect"
          />
        </template>
      </div>

      <p
        class="absolute left-[83%] top-[68.5%] w-[14%] text-left text-[1cqw] font-bold uppercase tracking-widest text-rose-950/70">
        Malus
      </p>
      <div class="absolute left-[82.6%] top-[72.5%] flex w-[14%] justify-start gap-1.5">
        <template v-if="curses.length">
          <TowerEffectPip
            v-for="(effect, i) in curses"
            :key="i"
            :effect="effect"
          />
        </template>
      </div>

      <p
        v-if="question.lootQuestion"
        class="absolute left-[20%] top-[8%] w-[60%] text-center text-[1.2cqw] font-semibold uppercase tracking-wide text-emerald-700"
      >
        Question loot — réponds juste et tu ouvres un coffre.
      </p>

      <p class="absolute left-1/2 top-[40%] flex h-[45%] w-[52%] -translate-x-1/2 -translate-y-1/2 items-center justify-center overflow-y-auto text-center text-[2.2cqw] leading-relaxed text-amber-800">
        {{ statement }}
      </p>

      <input
        id="tower-answer"
        ref="field"
        :value="modelValue"
        placeholder="Votre réponse..."
        type="text"
        autocomplete="off"
        class="absolute left-1/2 top-[72%] w-[40%] -translate-x-1/2 -translate-y-1/2 rounded border border-[#d2860070] text-amber-800 text-center bg-white px-[1.5cqw] py-[1.2cqw] text-[1.8cqw]  placeholder:italic placeholder:text-[#ecd6b3] focus:border-amber-0 focus:outline-none"
        @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
        @keydown.enter.prevent="$emit('submit')"
      >

      <!-- Le médaillon du chrono, à cheval sur le bord haut du cadre. -->
      <div
        class="absolute left-1/2 top-[-8%] z-20 w-[30%] -translate-x-1/2 -translate-y-1/2 bg-[url(/images/game-timer.webp)] bg-contain bg-center bg-no-repeat"
        style="aspect-ratio: 616 / 357;"
      >
        <span
          class="absolute left-1/2 top-[68%] -translate-x-1/2 -translate-y-1/2 pb-2 text-[3.3cqw] font-bold tabular-nums text-amber-600"
        >
          {{ secondsLeft }}
        </span>
      </div>

      <!-- Le bouton Valider, à cheval sur le bord bas du cadre. Le positionnement
           (translate de calage) vit sur ce conteneur ; le hover (scale) vit sur le
           bouton lui-même, pour ne pas composer les deux transforms — sinon le
           texte dérive légèrement de son repère au survol. -->
      <div
        class="absolute bottom-0 left-1/2 z-20 w-[32%] -translate-x-1/2 translate-y-1/2"
        style="aspect-ratio: 634 / 175;"
      >
        <button
          type="button"
          :disabled="submitting"
          class="flex h-full w-full appearance-none items-center justify-center border-0 bg-[url(/images/submit-button.webp)] bg-contain bg-center bg-no-repeat pb-2 text-[3.3cqw] font-semibold uppercase leading-none tracking-wider text-amber-600 outline-none transition-[transform,filter] ease-out will-change-transform hover:scale-110 hover:brightness-110 active:scale-105 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:brightness-100 disabled:opacity-60 enabled:cursor-pointer"
          @click="$emit('submit')"
        >
          Valider
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// L'écran de question en ascension, reskin parchemin/médiéval — voulu pour cet
// écran précis et lui seul, le reste de l'app reste sur le thème sombre. Le
// cadre, le médaillon du chrono et le bouton sont des illustrations
// (public/images/), text et input positionnés en absolu, proportionnellement
// à leurs dimensions. Tailles en cqw (voir container-type ci-dessus) : le
// texte doit rétrécir avec le cadre, pas rester fixe quand la carte se
// redimensionne. Écrit à part de BaseButton/BaseInput, dont les classes
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

// Espace insécable avant la ponctuation double du français : sans ça, un
// point d'interrogation esseulé se retrouve seul sur sa ligne dès que le
// retour à la ligne tombe juste avant lui.
const statement = computed(() => props.question.statement.replace(/ ([?!:;])/g, ' $1'))
</script>
