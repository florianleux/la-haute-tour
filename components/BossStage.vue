<template>
  <div class="contents">
    <!-- L'arrivée devant la porte attend d'abord les fichiers de ce boss, la
         première fois dans l'onglet : porte, introduction, combat. -->
    <AssetsLoadingScreen
      v-if="!assets.done.value"
      :floor="stage.floor"
    />

    <BossIntro
      v-else-if="introPlaying && stage.intro"
      :boss="stage.boss"
      :intro="stage.intro"
      :backdrop="stage.door.archColor"
      @end="emit('enter')"
    />

    <!-- ponytail: la porte déverrouillée pour tous, ouverte à chaque arrivée,
         l'introduction rejouée à chaque combat : les clés, la porte retenue
         et l'introduction jouée une fois viennent avec #137 à #143 et #39. -->
    <BossDoor
      v-else
      :door="stage.door"
      :keys-placed="0"
      :has-key="false"
      unlocked
      :opened="opened"
      @open-door="opened = true"
      @enter="enter"
    />
  </div>
</template>

<script setup lang="ts">
// Le chemin du palier au combat (specs/boss.md) : la porte, puis
// l'introduction du boss. Tout se joue côté client ; `enter`, au terme, rend la
// main à la page, qui demande au serveur d'ouvrir le combat.
import type { BossStage } from '~~/utils/bossStage'

const props = defineProps<{ stage: BossStage }>()

const emit = defineEmits<{ enter: [] }>()

const assets = useBossAssetsLoadingScreen(props.stage.floor)
const opened = ref(false)
const introPlaying = ref(false)

/** « Entrer » : l'introduction s'il y en a une, sinon le combat tout de suite. */
function enter(): void {
  if (props.stage.intro) {
    introPlaying.value = true
  }
  else {
    emit('enter')
  }
}
</script>
