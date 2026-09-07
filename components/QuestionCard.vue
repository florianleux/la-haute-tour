<template>
  <!-- <div class="fixed inset-0 z-0 bg-white bg-cover bg-center" /> -->
  <div class="fixed inset-0 z-0 bg-[url(/images/play-bg.webp)] bg-cover bg-center" />

  <div class="relative -mt-16 z-10 mx-auto w-full max-w-4xl py-8 sm:-mt-40 sm:py-16">
    <!-- container-type: inline-size fait de la largeur de cette carte l'unité de
         référence (cqw) pour tout ce qu'elle contient. bg-contain rétrécit le
         cadre sous ce seuil comme au-dessus ; sans cqw, le texte gardait sa
         taille en px et se détachait de ses rubans dès que le viewport rétrécit.
         Sous `sm`, le cadre passe au portrait mobile-play-card.webp (rubans
         sous le cadre plutôt qu'à côté) — voir components/StatsRibbons.vue. -->
    <div
      class="group relative mx-auto aspect-428/855 w-full @container bg-[url(/images/mobile-play-card.webp)] bg-contain bg-center bg-no-repeat sm:aspect-1980/775 sm:bg-[url(/images/game-card.webp)]"
    >
      <StatsRibbons
        :state="state"
        :effects="effects"
      />

      <p
        v-if="question.lootQuestion"
        class="absolute left-[8%] top-[4%] w-[84%] text-center text-[2cqw] font-semibold uppercase tracking-wide text-emerald-700 sm:left-[20%] sm:top-[8%] sm:w-[60%] sm:text-[1.2cqw]"
      >
        Question loot — réponds juste et tu ouvres un coffre.
      </p>

      <!-- Le clavier virtuel rétrécit la fenêtre visible sur mobile : le
           navigateur remonte le champ dans le cadre, poussant la question hors
           champ. `group-has-[#answer:focus]` la recale plus haut et la
           réduit tant que le clavier est ouvert — pas de JS, pas de mesure de
           hauteur de clavier, juste l'état du focus. -->
      <p
        class="absolute left-1/2 top-[35%] flex h-[35%] w-[84%] -translate-x-1/2 -translate-y-1/2 items-center justify-center overflow-y-auto text-center text-[6cqw] leading-relaxed text-amber-800 transition-all max-sm:group-has-[#answer:focus]:top-[46%] max-sm:group-has-[#answer:focus]:h-[18%] max-sm:group-has-[#answer:focus]:text-[5cqw] max-sm:group-has-[#answer:focus]:leading-[1.1em] sm:top-[40%] sm:h-[45%] sm:w-[52%] sm:text-[2.5cqw]">
        {{ statement }}
      </p>

      <input
        id="answer"
        ref="field"
        :value="modelValue"
        placeholder="Votre réponse..."
        type="text"
        autocomplete="off"
        class="absolute left-1/2 top-[60%] w-[76%] -translate-x-1/2 -translate-y-1/2 rounded border border-[#d2860070] bg-white px-[2.5cqw] py-[2cqw] text-center text-[6cqw] text-amber-800 placeholder:italic placeholder:text-[#ecd6b3] focus:border-amber-0 focus:outline-none sm:top-[75%] sm:w-[40%] sm:px-[1.5cqw] sm:py-[1.2cqw] sm:text-[1.8cqw]"
        @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
        @keydown.enter.prevent="$emit('submit')"
      >

      <!-- Le médaillon du chrono, à cheval sur le bord haut du cadre. Le bord
           haut coïncide avec le haut de l'image sur les deux fonds : pas de
           variante mobile nécessaire ici. -->
      <div
        class="absolute left-1/2 top-[7%] sm:top-[-8%] z-20 sm:w-[30%] w-[60%] -translate-x-1/2 -translate-y-1/2 bg-[url(/images/game-timer.webp)] bg-contain bg-center bg-no-repeat"
        style="aspect-ratio: 616 / 357;"
      >
        <span
          class="absolute left-1/2 top-[68%] -translate-x-1/2 -translate-y-1/2 pb-2 text-[8cqw] sm:text-[3.3cqw] font-bold tabular-nums text-amber-600"
        >
          {{ secondsLeft }}
        </span>
      </div>

      <CardButton
        label="Valider"
        anchor="card-bottom"
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

// Le focus auto ouvre le clavier physique sans y toucher — utile sur desktop,
// où Entrée enchaîne les questions sans jamais en sortir. Sur mobile, il n'y a
// pas de clavier physique : ce même focus ouvrirait le clavier virtuel tout
// seul à chaque question, ce que personne n'a demandé. Seuil aligné sur les
// classes `sm:` du reste du composant.
onMounted(() => {
  if (window.matchMedia('(min-width: 640px)').matches) {
    field.value?.focus()
  }
})

// Espace insécable avant la ponctuation double du français : sans ça, un
// point d'interrogation esseulé se retrouve seul sur sa ligne dès que le
// retour à la ligne tombe juste avant lui.
const statement = computed(() => props.question.statement.replace(/ ([?!:;])/g, ' $1'))
</script>
