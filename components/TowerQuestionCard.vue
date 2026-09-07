<template>
  <div class="relative mx-auto flex w-full max-w-3xl items-center justify-center py-16">
    <div class="absolute right-[calc(50%+17rem)] top-20 z-0 flex flex-col gap-9">
      <BaseRibbon
        tone="forest"
        side="left"
      >
        <p class="text-[0.5em] uppercase font-bold tracking-widest opacity-80">Étage</p>
        <p class=" text-xl font-bold">{{ state.floor }}</p>
      </BaseRibbon>
      <BaseRibbon
        side="left"
        tone="forest"
      >
        <p class="text-[0.5em] uppercase font-bold tracking-widest opacity-80">Palier</p>
        <p> <span class=" text-xl font-bold">{{ state.floorSeen }}</span>
          <span class="text-[0.6em]">/ {{ state.floorTotal }}</span>
        </p>
      </BaseRibbon>
      <BaseRibbon
        tone="forest"
        side="left"
      >
        <p class="text-[0.5em] uppercase font-bold tracking-widest opacity-80">Série en cours</p>
        <p class=" text-xl font-bold">{{ state.attemptSeen }}</p>
      </BaseRibbon>
    </div>

    <!-- La carte parchemin : bordure or épaisse, coins gravés, tout le reste en
         Tailwind — seule la forme des bannières (BaseRibbon) sort des utilitaires,
         un clip-path n'ayant pas d'équivalent utility. Voir CLAUDE.md#styling. -->
    <div
      class="relative z-10 w-full max-w-xl rounded-sm border-2 border-amber-300 bg-white px-11 pb-10 pt-10 text-stone-800 shadow-[0_0_0_10px_var(--color-amber-400),0_0_0_13px_var(--color-amber-200),0_22px_20px_rgba(0,0,0,0.35)]"
    >
      <div
        class="absolute left-1/2 -top-1 z-20 flex h-20 w-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-8 border-amber-400 bg-white "
      >
        <span class=" text-4xl font-bold tabular-nums text-amber-600">{{ secondsLeft }}</span>
      </div>

      <p
        v-if="question.lootQuestion"
        class="mb-3 text-center text-xs font-semibold uppercase tracking-wide text-emerald-700"
      >
        Question loot — réponds juste et tu ouvres un coffre.
      </p>

      <div class="flex min-h-32 items-center rounded bg-white/50 p-3">
        <p class=" text-xl leading-relaxed text-amber-800">{{ question.statement }}</p>
      </div>

      <div class="mt-6">
        <input
          id="tower-answer"
          ref="field"
          :value="modelValue"
          placeholder="Votre réponse..."
          type="text"
          autocomplete="off"
          class="w-full rounded border placeholder:italic placeholder:text-md placeholder:text-[#ecd6b3]  border-amber-300 bg-white px-4 py-3  text-lg text-stone-800 focus:border-amber-0 focus:outline-none"
          @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
          @keydown.enter.prevent="$emit('submit')"
        >
      </div>

      <div class="relative z-20 -mb-20 mt-8 flex justify-center">
        <button
          type="button"
          :disabled="submitting"
          class="rounded-full border-8 border-amber-400 bg-white px-10 py-2.5 text-xl font-semibold uppercase tracking-wider text-amber-600  transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          @click="$emit('submit')"
        >
          Valider
        </button>
      </div>
    </div>

    <div class="absolute left-[calc(50%+17rem)] top-20 z-0 flex flex-col gap-9">
      <BaseRibbon side="right">
        <p class="text-[0.5em] uppercase font-bold tracking-widest opacity-80">Vies</p>
        <p class="text-2xl leading-none">
          <span
            v-for="n in state.lives"
            :key="n"
          >♥</span>
        </p>
      </BaseRibbon>
      <BaseRibbon
        v-if="boons.length"
        side="right"
      >
        <p class="text-[0.5em] uppercase font-bold tracking-widest opacity-80">Bonus</p>
        <div class="mt-1 flex justify-center gap-1.5">
          <TowerEffectPip
            v-for="(effect, i) in boons"
            :key="i"
            :effect="effect"
          />
        </div>
      </BaseRibbon>
      <BaseRibbon
        v-if="curses.length"
        side="right"
      >
        <p class="text-[0.5em] uppercase font-bold tracking-widest opacity-80">Malus</p>
        <div class="mt-1 flex justify-center gap-1.5">
          <TowerEffectPip
            v-for="(effect, i) in curses"
            :key="i"
            :effect="effect"
          />
        </div>
      </BaseRibbon>
    </div>
  </div>
</template>

<script setup lang="ts">
// L'écran de question en ascension, reskin parchemin/médiéval — voulu pour cet
// écran précis et lui seul, le reste de l'app reste sur le thème sombre. Écrit
// à part de BaseButton/BaseInput, dont les classes portent justement l'autre
// thème : les reprendre ici les recouvrirait en ligne, ce que CLAUDE.md
// interdit — plus simple de sortir du système Base* pour cet écran isolé.
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
