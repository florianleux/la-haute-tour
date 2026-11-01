<template>
  <!-- Le fond noir ; Julien bras écartés, qui rit du joueur tombé ;
       « DÉFAITE » en grand titre comme le nom du boss à l'introduction, mais
       rouge, et qui reste ; puis sa réplique et « Redescendre ». -->
  <BossOutroScene
    :boss="boss"
    pose="open"
    expression="laugh"
    :remark="boss.defeatLine"
    backdrop="bg-black"
    :colors="colors"
    :figure-box="figureBox"
    :gestures="[{ label: 'Redescendre', run: () => emit('leave') }]"
    :title-ms="3500"
  >
    <template #title>
      <p
        class="text-[5.5cqw] [--title-ms:4500ms]"
        :class="TITLE_RED"
      >
        Défaite
      </p>
    </template>
  </BossOutroScene>
</template>

<script setup lang="ts">
// L'outro de défaite (specs/spec.md#glossaire, Outro de défaite) : la dernière
// vie perdue contre le boss, son verdict lu, avant le camp en attente. Rien ne
// s'y joue côté serveur — l'attente a déjà commencé ; « Redescendre » ne fait
// que quitter l'écran, comme après une chute.
import { TITLE_RED } from '~~/utils/typography'
import type { BossEntry } from '~~/utils/bosses'

defineProps<{
  boss: BossEntry
  /** Les couleurs de sa fenêtre, celles de son introduction ; absentes, celles du joueur. */
  colors?: string
  /** Sa place à l'introduction (`figureBox` de bossIntros). */
  figureBox?: string
}>()

const emit = defineEmits<{ leave: [] }>()
</script>
