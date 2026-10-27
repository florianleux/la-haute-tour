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
      :action-label="action?.label ?? null"
      :busy="submitting || advancing"
      @update:model-value="emit('update:modelValue', $event)"
      @submit="emit('submit')"
      @advance="emit('advance')"
    />
  </BossArena>
</template>

<script setup lang="ts">
// L'écran du combat de boss : l'arène (BossArena), l'épreuve servie au milieu.
// Tout vient de l'état servi — PV, vies, épreuve, verdict — et rien n'y est
// jugé : la réponse part au serveur. Voir specs/boss.md.
import type { BossView } from '~~/server/utils/boss'
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
}>()

const emit = defineEmits<{ 'update:modelValue': [value: string], 'submit': [], 'advance': [] }>()

/** L'épreuve servie, ou celle qui vient d'être jugée. */
const shown = computed(() => props.boss.trial ?? props.boss.verdict)
</script>
