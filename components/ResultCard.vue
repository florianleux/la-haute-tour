<template>
  <div class="fixed inset-0 z-0 bg-white bg-cover bg-center" />
  <!-- <div class="fixed inset-0 z-0 bg-[url(/images/play-bg.webp)] bg-cover bg-center" /> -->

  <div class="relative -mt-40 z-10 mx-auto w-full max-w-4xl py-16">
    <!-- Même squelette que QuestionCard : le résultat d'une question est le
         même écran que la question elle-même, pas un autre. Voir
         components/QuestionCard.vue pour le détail des choix (cqw,
         container-type, sortie du système Base*). -->
    <div
      class="relative mx-auto w-full bg-[url(/images/game-card.webp)] bg-contain bg-center bg-no-repeat"
      style="aspect-ratio: 1980 / 775; container-type: inline-size;"
    >
      <StatsRibbons
        :state="state"
        :effects="effects"
      />

      <!-- Le parchemin : verdict de la question qui vient de se jouer, palier ou
           fin de partie s'ils s'annoncent par-dessus. -->
      <div
        class="absolute left-1/2 top-[36%] flex h-[70%] w-[56%] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center gap-[1.2cqw] overflow-y-auto text-center"
      >
        <template v-if="screen.verdict">
          <p
            class="text-[3cqw] font-bold"
            :class="screen.verdict.correct ? 'text-emerald-700' : 'text-rose-700'"
          >
            {{ screen.verdict.correct ? 'Correct !' : 'Incorrect...' }}
          </p>
          <p class="text-[2.2cqw] leading-relaxed text-amber-800">
            {{ statement }}
          </p>
          <p class="text-[1.6cqw] -mt-2 text-amber-800">
            <strong>{{ screen.verdict.answerLabel }}</strong>
          </p>
          <p class="text-[1.4cqw] text-amber-800/80">
            Ta réponse : {{ screen.verdict.submittedAnswer || '(rien)' }}
          </p>
          <p
            v-if="screen.verdict.lifeLost"
            class="text-[1.4cqw] font-semibold text-rose-700"
          >
            Tu perds une vie.
          </p>

          <!-- Voir specs/anti-triche.md#perte-de-focus. -->
          <p
            v-if="leftThePage"
            class="text-[1.2cqw] text-amber-700"
          >
            Tu as quitté la page : ta réponse a été envoyée en l'état.
          </p>

          <!-- Voir specs/validation.md. -->
          <button
            v-if="contestable"
            type="button"
            :disabled="contesting"
            class="cursor-pointer text-[1.2cqw] font-semibold text-amber-700 underline underline-offset-2 transition hover:text-amber-900 disabled:cursor-not-allowed disabled:opacity-60"
            @click="$emit('dispute')"
          >
            Contester cette question
          </button>

          <!-- Le coffre s'ouvre sur un écran à part (ChestCard) : ici
               seulement l'annonce qu'il y en a un. Voir specs/bonus.md#coffre-et-mimic. -->
          <p
            v-if="screen.chest && !screen.chest.opened"
            class="text-[1.3cqw] font-semibold text-emerald-700"
          >
            Tu as gagné un coffre.
          </p>

          <!-- Voir specs/ecrans.md#jeu. -->
          <p
            v-if="screen.recovery?.result"
            class="text-[1.3cqw] font-semibold"
            :class="screen.recovery.result === 'resumed' ? 'text-emerald-700' : 'text-amber-700'"
          >
            {{ screen.recovery.result === 'resumed'
              ? 'Rattrapage réussi : tes vies sont restaurées.'
              : 'Aucune bonne réponse : une nouvelle attente commence.' }}
          </p>
        </template>

        <!-- Voir specs/mecanique.md#fin-détage. -->
        <template v-if="screen.phase === 'floorEnd'">
          <p class="text-[2cqw] font-bold text-amber-800">
            Étage {{ state.floor }} terminé.
          </p>
          <p class="text-[1.3cqw] text-amber-800/80">
            Tu as vu toutes ses questions. Ce que tu y as raté reste à cet étage :
            le suivant repart d'une fiche vierge.
          </p>
        </template>

        <template v-else-if="screen.phase === 'gameOver'">
          <p class="text-[2cqw] font-bold text-emerald-700">
            Tu as fini La Haute Tour.
          </p>
          <p class="text-[1.3cqw] text-amber-800/80">
            Tous les étages sont derrière toi. Bravo.
          </p>
        </template>
      </div>

      <!-- Le médaillon, à cheval sur le bord haut du cadre : juste/faux au lieu du
           chrono, il n'y a plus de temps qui court sur un verdict. -->
      <div
        v-if="screen.verdict"
        class="absolute left-1/2 top-[-8%] z-20 w-[30%] -translate-x-1/2 -translate-y-1/2 bg-[url(/images/game-timer.webp)] bg-contain bg-center bg-no-repeat"
        style="aspect-ratio: 616 / 357;"
      >
        <span
          class="absolute left-1/2 top-[68%] -translate-x-1/2 -translate-y-1/2 pb-2 text-[5cqw] font-bold"
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
