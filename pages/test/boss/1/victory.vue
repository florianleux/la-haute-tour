<template>
  <BossFightCard
    :key="round"
    :lives="state.lives"
    :max-lives="rules.lives"
    :boss="boss"
    :stage="stage"
    :player-name="user?.displayName ?? ''"
    :portrait="playerPortrait(user?.gender ?? null)"
    model-value=""
    :seconds-left="null"
    :submitting="false"
    :action="view.action"
    :advancing="false"
    :relic="view.card === 'bossFight' ? view.relic : null"
    @advance="advance"
  />
</template>

<script setup lang="ts">
// Banc de l'outro de victoire du boss de l'étage 1 : même carte qu'en jeu
// (BossFightCard), sur un combat fini posé à la main — le dernier verdict,
// la nuit qui monte, puis la relique. Son dernier OK rejoue la scène plutôt
// que de franchir. `?passed` montre le passage du 6e combat perdu.
// Admin seulement. Voir specs/ecrans.md et specs/boss.md#récompense.
import { rulesForFloor } from '~~/server/utils/rules'
import type { BossView } from '~~/server/utils/boss'
import { bossStageOf } from '~~/utils/bossStage'
import { playView } from '~~/utils/phase'

definePageMeta({ admin: true })

const rules = rulesForFloor(1)
const stage = bossStageOf(1)
const passed = 'passed' in useRoute().query

const { user } = await useCurrentUser()

// Le dernier drapeau du combat, jugé : juste pour la victoire, faux pour le
// passage, qui garde ses PV au boss.
const boss: BossView = {
  hp: passed ? rules.bossHp : 0,
  maxHp: rules.bossHp,
  trial: null,
  verdict: {
    image: '419dd040b5e72e1a',
    correct: !passed,
    answerLabel: 'La Transnistrie',
    submittedAnswer: passed ? 'Moldavie' : 'Transnistrie',
  },
  outcome: passed ? 'passed' : 'victory',
  relic: 'JULIEN_CARD',
}

const state = demoState({ phase: 'bossFight', floor: 1, lives: passed ? 0 : 1, boss })

/** L'étage dont la relique est montrée, comme la page de jeu le retient. */
const relicOf = ref<number | null>(null)
/** Remonte la carte à chaque tour : la nuit retombe depuis le verdict. */
const round = ref(0)

const view = computed(() => playView(state, { chestOf: null, fallenOn: null, relicOf: relicOf.value }))

function advance(): void {
  const action = view.value.action
  if (action?.move === 'revealRelic') {
    relicOf.value = action.relicOf
    return
  }
  relicOf.value = null
  round.value++
}
</script>
