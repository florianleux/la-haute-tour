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
      <StatsRibbons
        :state="state"
        :effects="effects"
      />

      <p
        v-if="question.lootQuestion"
        class="absolute left-[20%] top-[8%] w-[60%] text-center text-[1.2cqw] font-semibold uppercase tracking-wide text-emerald-700"
      >
        Question loot — réponds juste et tu ouvres un coffre.
      </p>

      <p
        class="absolute left-1/2 top-[40%] flex h-[45%] w-[52%] -translate-x-1/2 -translate-y-1/2 items-center justify-center overflow-y-auto text-center text-[2.5cqw] leading-relaxed text-amber-800">
        {{ statement }}
      </p>

      <input
        id="answer"
        ref="field"
        :value="modelValue"
        placeholder="Votre réponse..."
        type="text"
        autocomplete="off"
        class="absolute left-1/2 top-[75%] w-[40%] -translate-x-1/2 -translate-y-1/2 rounded border border-[#d2860070] text-amber-800 text-center bg-white px-[1.5cqw] py-[1.2cqw] text-[1.8cqw]  placeholder:italic placeholder:text-[#ecd6b3] focus:border-amber-0 focus:outline-none"
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

      <CardButton
        label="Valider"
        :disabled="submitting"
        @click="$emit('submit')"
      />
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

// Espace insécable avant la ponctuation double du français : sans ça, un
// point d'interrogation esseulé se retrouve seul sur sa ligne dès que le
// retour à la ligne tombe juste avant lui.
const statement = computed(() => props.question.statement.replace(/ ([?!:;])/g, ' $1'))
</script>
