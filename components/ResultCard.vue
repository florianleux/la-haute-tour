<template>
  <PlayFrame
    skin="ascent"
    :reaction="reaction"
  >
    <template #ribbons>
      <!-- Palier et Série prennent un sur tout verdict d'ascension, juste ou
           faux (le rattrapage n'arrive pas ici, voir RecoveryCard). -->
      <StatsRibbons
        :state="state"
        :effects="effects"
        :counted="Boolean(screen.verdict)"
        :life-lost="screen.verdict?.lifeLost"
      />
    </template>

    <!-- Juste ou faux au lieu du chrono : il n'y a plus de temps qui court sur
         un verdict. Pas de médaillon du tout sur un palier ou une fin de
         partie, qui ne jugent aucune réponse. -->
    <template
      v-if="screen.verdict"
      #medallion
    >
      <VerdictMark :correct="screen.verdict.correct" />
    </template>

    <template v-if="screen.verdict">
      <VerdictLines
        :verdict="screen.verdict"
        :disputable="disputable"
        :disputing="disputing"
        :last-life="state.lives <= 0"
        @dispute="$emit('dispute')"
      />

      <!-- Le coffre s'ouvre sur un écran à part (ChestCard) : ici seulement
           l'annonce qu'il y en a un. Voir specs/bonus.md#coffre-et-mimic. -->
      <PlayText
        v-if="screen.chest && !screen.chest.opened"
        role="notice"
        class="text-emerald-700"
      >
        Tu as gagné un coffre.
      </PlayText>
    </template>

    <!-- Voir specs/mecanique.md#fin-détage. -->
    <template v-if="screen.phase === 'floorEnd'">
      <PlayText
        role="headline"
        class="text-amber-800"
      >
        Étage {{ state.floor }} terminé.
      </PlayText>
      <PlayText
        role="aside"
        class="text-amber-800/80"
      >
        Tu as vu toutes ses questions. Ce que tu y as raté reste à cet étage :
        le suivant repart d'une fiche vierge.
      </PlayText>
    </template>

    <template v-else-if="screen.phase === 'gameOver'">
      <PlayText
        role="headline"
        class="text-emerald-700"
      >
        Tu as fini La Haute Tour.
      </PlayText>
      <PlayText
        role="aside"
        class="text-amber-800/80"
      >
        Tous les étages sont derrière toi. Bravo.
      </PlayText>
    </template>

    <template #action>
      <!-- « Suivant » mène à l'écran de coffre tant qu'il est fermé, sinon
           c'est l'action suivante — jamais les deux en même temps.
           Voir utils/phase.ts. -->
      <BaseCardButton
        v-if="bottomAction"
        :label="bottomAction.label"
        anchor="card-bottom"
        :disabled="bottomAction.loading"
        @click="bottomAction.run"
      />
    </template>
  </PlayFrame>
</template>

<script setup lang="ts">
// L'écran de résultat : verdict d'une question, palier franchi ou fin de
// partie — même cadre que QuestionCard, parce que c'est le même écran de jeu
// qui continue de parler, pas un autre. Voir specs/ecrans.md#jeu.
//
// Le verdict du rattrapage n'atteint jamais cette carte : la phase `recovery`
// est servie par RecoveryCard, question et verdict compris. Les phases
// `cooldown` et `recovery` n'y arrivent que par le verdict de la dernière vie.
import type { GameState } from '~~/server/utils/game'
import type { GameScreen } from '~~/utils/phase'
import type { EffectView } from '~~/server/utils/effects'

const props = defineProps<{
  state: GameState
  screen: GameScreen
  effects: EffectView[]
  disputable: boolean
  disputing: boolean
  leftThePage: boolean
  advancing: boolean
}>()

const emit = defineEmits<{ dispute: [], 'enter-chest': [], advance: [] }>()

// Le cadre saute de joie sur le juste, encaisse un coup sur la vie perdue.
const reaction = computed(() => {
  if (props.screen.verdict?.correct) {
    return 'hop'
  }
  return props.screen.verdict?.lifeLost ? 'hit' : undefined
})

// Le coffre fermé retient le joueur, mais ce n'est plus ce bouton qui
// l'ouvre : « Suivant » mène à un écran à part (ChestCard), l'ouverture
// elle-même y a son propre bouton « OUVRIR ». Voir specs/bonus.md#coffre-et-mimic.
const bottomAction = computed(() => {
  if (props.screen.chest && !props.screen.chest.opened) {
    return { label: 'Suivant', loading: false, run: () => emit('enter-chest') }
  }

  // Le verdict de la question qui a pris la dernière vie : le serveur est déjà
  // en attente, ce bouton ne fait que mener au poster (voir pages/index.vue).
  if (props.screen.phase === 'cooldown' || props.screen.phase === 'recovery') {
    return { label: 'Redescendre', loading: false, run: () => emit('advance') }
  }

  if (props.screen.action) {
    return { label: props.screen.action, loading: props.advancing, run: () => emit('advance') }
  }

  return null
})
</script>
