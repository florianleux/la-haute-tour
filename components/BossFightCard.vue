<template>
  <BossArena
    :boss="stage.boss"
    :boss-hp="boss.hp"
    :boss-max-hp="boss.maxHp"
    :player-name="playerName"
    :portrait="portrait"
    :lives="lives"
    :max-lives="maxLives"
  >
    <BossFlagTrial
      v-if="shown"
      :image="shown.image"
      :seconds-left="secondsLeft"
      :verdict="boss.trial ? null : boss.verdict"
      :outcome="boss.outcome"
      :model-value="modelValue"
      :action-label="ended || defeated ? null : action?.label ?? null"
      :busy="submitting || advancing"
      :motion="submitting ? 'judging' : advancing ? 'leaving' : undefined"
      @update:model-value="emit('update:modelValue', $event)"
      @submit="emit('submit')"
      @advance="emit('advance')"
    />
  </BossArena>

  <!-- Perdu, verdict lu : l'arène s'efface au noir sous l'outro de défaite,
       qui porte « Redescendre ». -->
  <BossOutro
    v-if="defeated"
    :boss="stage.boss"
    :colors="stage.intro?.windowColors"
    :figure-box="stage.intro?.figureBox"
    @leave="emit('advance')"
  />

  <!-- Gagné ou passé : la nuit monte, et c'est elle qui porte le geste. -->
  <BossVictory
    v-if="ended"
    :boss="stage.boss"
    :outcome="ended"
    :colors="stage.intro?.windowColors"
    :figure-box="stage.intro?.figureBox"
    :veiled="relicItem !== null"
    @next="emit('advance')"
  />

  <!-- La relique du boss abattu, montrée comme le Fromage, entre « Continuer »
       et le palier franchi. Voir specs/boss.md#récompense. -->
  <ItemReveal
    v-if="relicItem"
    title="Relique obtenue"
    :label="relicItem.name"
    :image="relicItem.image"
    @close="emit('advance')"
  />
</template>

<script setup lang="ts">
// L'écran du combat de boss : l'arène (BossArena), l'épreuve servie au milieu.
// Tout vient de l'état servi — PV, vies, épreuve, verdict — et rien n'y est
// jugé : la réponse part au serveur. Voir specs/boss.md.
import { bossBeaten } from '~~/server/utils/mechanics'
import type { BossView } from '~~/server/utils/boss'
import type { ItemId } from '~~/shared/utils/items'
import type { BossStage } from '~~/utils/bossStage'
import type { PlayAction } from '~~/utils/phase'

const props = defineProps<{
  lives: number
  maxLives: number
  boss: BossView
  stage: BossStage
  playerName: string
  portrait: string
  modelValue: string
  secondsLeft: number | null
  submitting: boolean
  action: PlayAction | null
  advancing: boolean
  /** La relique du boss abattu, montrée avant le palier ; null sinon. */
  relic?: ItemId | null
  /** La défaite, son dernier verdict quitté : l'outro de défaite par-dessus l'arène. */
  defeated?: boolean
}>()

const emit = defineEmits<{ 'update:modelValue': [value: string], 'submit': [], 'advance': [] }>()

/** Le combat gagné ou passé, que l'outro de victoire montre. Null sinon. */
const ended = computed(() => bossBeaten(props.boss.outcome) ? props.boss.outcome : null)

/** L'épreuve servie, ou celle qui vient d'être jugée. */
const shown = computed(() => props.boss.trial ?? props.boss.verdict)

const relicItem = computed(() => props.relic ? itemLabel(props.relic) : null)
</script>
