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

    <!-- ponytail: aucune clé à poser, l'introduction rejouée à chaque
         combat : les clés et l'introduction jouée une fois viennent avec #138
         à #143 et #39. -->
    <BossDoor
      v-else
      :door="stage.door"
      :keys-placed="door.keyHolders.length"
      :has-key="false"
      :unlocked="door.unlocked"
      :opened="opened"
      @open-door="openDoor"
      @enter="enter"
    />
  </div>
</template>

<script setup lang="ts">
// Le chemin du palier au combat (specs/boss.md) : la porte, puis
// l'introduction du boss. La porte se lit au serveur ; `openDoor` lui dit que
// le joueur l'a ouverte, `enter`, au terme, qu'il ouvre le combat.
import type { DoorView } from '~~/server/utils/game'
import type { BossStage } from '~~/utils/bossStage'

const props = defineProps<{ stage: BossStage, door: DoorView }>()

const emit = defineEmits<{ openDoor: [], enter: [] }>()

const assets = useBossAssetsLoadingScreen(props.stage.floor)
// Les battants s'écartent au clic, sans attendre le serveur : il retient le
// geste pour le retour, l'animation n'a pas à l'attendre.
const opened = ref(props.door.opened)
const introPlaying = ref(false)

function openDoor(): void {
  opened.value = true
  emit('openDoor')
}

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
