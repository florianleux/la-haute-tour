<template>
  <!-- <div class="fixed inset-0 z-0 bg-white bg-cover bg-center" /> -->
  <div class="fixed inset-0 z-0 bg-[url(/images/play-bg.webp)] bg-cover bg-center" />

  <div class="relative -mt-16 z-10 mx-auto w-full max-w-4xl py-8 sm:-mt-40 sm:py-16">
    <!-- Même squelette que QuestionCard : le résultat d'une question est le
         même écran que la question elle-même, pas un autre. Voir
         components/QuestionCard.vue pour le détail des choix (cqw,
         container-type, sortie du système Base*, bascule mobile/desktop). -->
    <div
      class="relative mx-auto aspect-428/855 w-full @container bg-[url(/images/mobile-play-card.webp)] bg-contain bg-center bg-no-repeat sm:aspect-1980/775 sm:bg-[url(/images/game-card.webp)]"
    >
      <StatsRibbons
        :state="state"
        :effects="effects"
      />

      <template v-if="screen.verdict">
        <p
          class="absolute left-1/2 top-[18%] w-[84%] -translate-x-1/2 text-center text-[7cqw] font-bold sm:left-1/2 sm:top-[14%] sm:w-[56%] sm:text-[2.5cqw]"
          :class="screen.verdict.correct ? 'text-emerald-700' : 'text-rose-700'"
        >
          {{ screen.verdict.correct ? 'Correct !' : 'Incorrect...' }}
        </p>
        <p
          class="absolute left-1/2 top-[30%] flex h-[28%] w-[84%] -translate-x-1/2 -translate-y-1/2 items-center justify-center overflow-y-auto text-center text-[5.2cqw]  leading text-amber-800 sm:top-[38%] sm:h-[30%] sm:w-[56%] sm:text-[1.8cqw]">
          {{ statement }}

        </p>
        <p
          class="absolute uppercase left-1/2 top-[52%] w-[84%] -translate-x-1/2 text-center text-[3.8cqw] text-amber-800 sm:top-[52%] sm:w-[56%] sm:text-[2.2cqw]">
          <strong>{{ screen.verdict.answerLabel }}</strong>
        </p>
        <p
          class="absolute left-1/2 top-[60%] w-[84%] -translate-x-1/2 text-center text-[3.3cqw] text-amber-800/80 sm:top-[60%] sm:w-[56%] sm:text-[1.4cqw]">
          Ta réponse : {{ screen.verdict.submittedAnswer || '(rien)' }}
        </p>
        <p
          v-if="screen.verdict.lifeLost"
          class="absolute left-1/2 top-[68%] w-[84%] -translate-x-1/2 text-center text-[3.3cqw] font-semibold text-rose-700 sm:top-[68%] sm:w-[56%] sm:text-[2.2cqw]"
        >
          Tu perds une vie !
        </p>
        <button
          v-if="contestable"
          type="button"
          :disabled="contesting"
          class="absolute left-1/2 top-[78%] w-[84%] -translate-x-1/2 cursor-pointer text-center text-[2.8cqw] font-semibold text-amber-700 underline underline-offset-2 transition hover:text-amber-900 disabled:cursor-not-allowed disabled:opacity-60 sm:top-[77%] sm:w-[56%] sm:text-[1.3cqw]"
          @click="$emit('dispute')"
        >
          Contester cette question
        </button>

        <!-- Voir specs/validation.md. -->

        <!-- Le coffre s'ouvre sur un écran à part (ChestCard) : ici
             seulement l'annonce qu'il y en a un. Voir specs/bonus.md#coffre-et-mimic. -->
        <p
          v-if="screen.chest && !screen.chest.opened"
          class="absolute left-1/2 top-[80%] w-[84%] -translate-x-1/2 text-center text-[3cqw] font-semibold text-emerald-700 sm:top-[86%] sm:w-[56%] sm:text-[1.3cqw]"
        >
          Tu as gagné un coffre.
        </p>

        <!-- Voir specs/ecrans.md#jeu. -->
        <p
          v-if="screen.recovery?.result"
          class="absolute left-1/2 top-[86%] w-[84%] -translate-x-1/2 text-center text-[3cqw] font-semibold sm:top-[92%] sm:w-[56%] sm:text-[1.3cqw]"
          :class="screen.recovery.result === 'resumed' ? 'text-emerald-700' : 'text-amber-700'"
        >
          {{ screen.recovery.result === 'resumed'
            ? 'Rattrapage réussi : tes vies sont restaurées.'
            : 'Aucune bonne réponse : une nouvelle attente commence.' }}
        </p>
      </template>

      <!-- Voir specs/mecanique.md#fin-détage. -->
      <template v-if="screen.phase === 'floorEnd'">
        <p
          class="absolute left-1/2 top-[35%] w-[84%] -translate-x-1/2 text-center text-[4.6cqw] font-bold text-amber-800 sm:top-[42%] sm:w-[56%] sm:text-[2cqw]">
          Étage {{ state.floor }} terminé.
        </p>
        <p
          class="absolute left-1/2 top-[45%] w-[84%] -translate-x-1/2 text-center text-[3cqw] text-amber-800/80 sm:top-[52%] sm:w-[56%] sm:text-[1.3cqw]">
          Tu as vu toutes ses questions. Ce que tu y as raté reste à cet étage :
          le suivant repart d'une fiche vierge.
        </p>
      </template>

      <template v-else-if="screen.phase === 'gameOver'">
        <p
          class="absolute left-1/2 top-[35%] w-[84%] -translate-x-1/2 text-center text-[4.6cqw] font-bold text-emerald-700 sm:top-[42%] sm:w-[56%] sm:text-[2cqw]">
          Tu as fini La Haute Tour.
        </p>
        <p
          class="absolute left-1/2 top-[45%] w-[84%] -translate-x-1/2 text-center text-[3cqw] text-amber-800/80 sm:top-[52%] sm:w-[56%] sm:text-[1.3cqw]">
          Tous les étages sont derrière toi. Bravo.
        </p>
      </template>

      <!-- Le médaillon, à cheval sur le bord haut du cadre : juste/faux au lieu du
           chrono, il n'y a plus de temps qui court sur un verdict. Même
           traitement mobile que le médaillon du chrono sur QuestionCard :
           plus bas et plus large sous `sm`, pour rester lisible sur un petit
           écran. -->
      <div
        v-if="screen.verdict"
        class="absolute left-1/2 top-[7%] z-20 w-[60%] -translate-x-1/2 -translate-y-1/2 bg-[url(/images/game-timer.webp)] bg-contain bg-center bg-no-repeat sm:top-[-8%] sm:w-[30%]"
        style="aspect-ratio: 616 / 357;"
      >
        <span
          class="absolute left-1/2 top-[68%] -translate-x-1/2 -translate-y-1/2 pb-2 text-[12cqw] font-bold sm:text-[5cqw]"
          :class="screen.verdict.correct ? 'text-emerald-600' : 'text-rose-600'"
        >
          {{ screen.verdict.correct ? '✓' : '✗' }}
        </span>
      </div>

      <!-- Le bouton du bas : « Suivant » mène à l'écran de coffre tant qu'il est
           fermé, sinon c'est l'action suivante — jamais les deux en même temps.
           Voir utils/phase.ts. -->
      <CardButton
        v-if="bottomAction"
        :label="bottomAction.label"
        anchor="card-bottom"
        :disabled="bottomAction.loading"
        size="sm"
        @click="bottomAction.run"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
// L'écran de résultat : verdict d'une question, palier franchi ou fin de
// partie — même structure que QuestionCard, parce que c'est le même
// écran de jeu qui continue de parler, pas un autre. Voir specs/ecrans.md#jeu.
import type { GameState } from '~~/server/utils/game'
import type { GameScreen } from '~~/utils/phase'
import type { EffectView } from '~~/server/utils/effects'

const props = defineProps<{
  state: GameState
  screen: GameScreen
  effects: EffectView[]
  contestable: boolean
  contesting: boolean
  leftThePage: boolean
  advancing: boolean
}>()

const emit = defineEmits<{ dispute: [], 'enter-chest': [], advance: [] }>()

// Même traitement que QuestionCard : espace insécable avant la
// ponctuation double du français, sinon un point d'interrogation esseulé se
// retrouve seul sur sa ligne.
const statement = computed(() => props.screen.verdict?.statement.replace(/ ([?!:;])/g, ' $1') ?? '')

// Le coffre fermé retient le joueur, mais ce n'est plus ce bouton qui
// l'ouvre : « Suivant » mène à un écran à part (ChestCard), l'ouverture
// elle-même y a son propre bouton « OUVRIR ». Voir specs/bonus.md#coffre-et-mimic.
const bottomAction = computed(() => {
  if (props.screen.chest && !props.screen.chest.opened) {
    return { label: 'Suivant', loading: false, run: () => emit('enter-chest') }
  }

  if (props.screen.action) {
    return { label: props.screen.action, loading: props.advancing, run: () => emit('advance') }
  }

  return null
})
</script>
