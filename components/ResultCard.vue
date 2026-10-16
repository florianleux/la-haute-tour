<template>
  <PlayFrame
    skin="ascent"
    :reaction="reaction"
    :motion="advancing ? 'leaving' : undefined"
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
      <!-- Le libellé et le geste se décident dans utils/phase.ts (playView) :
           entrer dans le coffre, redescendre au poster, ou la suite. -->
      <BaseCardButton
        v-if="action"
        :label="action.label"
        anchor="card-bottom"
        :loading="advancing"
        @click="$emit('advance')"
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
import type { GameScreen, PlayAction } from '~~/utils/phase'
import type { EffectView } from '~~/server/utils/effects'

const props = defineProps<{
  state: GameState
  screen: GameScreen
  effects: EffectView[]
  /** Le bouton du bas — libellé et geste —, null quand rien n'avance d'ici. Voir utils/phase.ts (playView). */
  action: PlayAction | null
  disputable: boolean
  disputing: boolean
  advancing: boolean
}>()

defineEmits<{ dispute: [], advance: [] }>()

// Le cadre saute de joie sur le juste, encaisse un coup sur la vie perdue.
const reaction = computed(() => {
  if (props.screen.verdict?.correct) {
    return 'hop'
  }
  return props.screen.verdict?.lifeLost ? 'hit' : undefined
})
</script>
