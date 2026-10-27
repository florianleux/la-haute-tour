<template>
  <!-- La nuit de l'arène, sans les barres de vie : le combat est fini. -->
  <div
    class="fixed inset-0 z-1 overflow-hidden @container-size"
    :class="BOSS_NIGHT"
  >
    <div :class="[BACKDROP_BOX, BACKDROP_COVER]">
      <div
        class="@container"
        :class="BACKDROP_SCENE"
      >
        <!-- « DÉFAITE », en grand titre comme le nom du boss à l'introduction,
             mais rouge, et qui reste. -->
        <p
          class="absolute inset-x-0 top-[6%] text-center text-[5.5cqw]"
          :class="TITLE_RED"
        >
          Défaite
        </p>

        <!-- Le boss au milieu, bras écartés, qui rit du joueur tombé. -->
        <BossFigure
          :figure="boss.figure"
          pose="open"
          expression="laugh"
          :talking="false"
          class="absolute left-1/2 top-[22%] w-[42%] -translate-x-1/2"
        />

        <BaseDialogueWindow
          :remark="boss.defeatLine"
          :colors="colors"
          :gestures="[{ label: 'Redescendre', run: () => emit('leave') }]"
          class="absolute bottom-[5%] left-1/2 w-[51%] -translate-x-1/2"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// L'outro de défaite (specs/spec.md#glossaire, Outro de défaite) : la dernière
// vie perdue contre le boss, avant le camp en attente. Rien ne s'y joue côté
// serveur — l'attente a déjà commencé ; « Redescendre » ne fait que quitter
// l'écran, comme après une chute.
import { BACKDROP_BOX, BACKDROP_COVER, BACKDROP_SCENE, BOSS_NIGHT } from '~~/utils/backdrop'
import { TITLE_RED } from '~~/utils/typography'
import type { BossEntry } from '~~/utils/bosses'

defineProps<{
  boss: BossEntry
  /** Les couleurs de sa fenêtre, celles de son introduction ; absentes, celles du joueur. */
  colors?: string
}>()

const emit = defineEmits<{ leave: [] }>()
</script>
