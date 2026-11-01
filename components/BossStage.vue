<template>
  <div class="contents">
    <!-- L'arrivée devant la porte attend d'abord les fichiers de ce boss, la
         première fois dans l'onglet : porte, introduction, combat. -->
    <AssetsLoadingScreen
      v-if="!assets.done.value"
      :floor="stage.floor"
    />

    <BossIntro
      v-else-if="introPlaying && intro"
      :boss="stage.boss"
      :intro="intro"
      :backdrop="stage.door.archColor"
      @end="emit('enter')"
    />

    <BossDoor
      v-else
      :door="stage.door"
      :keys-placed="door.keyHolders.length"
      :has-key="door.hasKey"
      :unlocked="door.unlocked"
      :opened="opened"
      @place-key="emit('placeKey')"
      @open-door="openDoor"
      @descend-to-camp="emit('descendToCamp')"
      @enter="enter"
    />
  </div>
</template>

<script setup lang="ts">
// Le chemin du palier au combat (specs/boss.md) : la porte, puis
// l'introduction du boss. La porte se lit au serveur ; `placeKey` lui dit
// que le joueur y pose sa clé, `openDoor` qu'il l'a ouverte, `descendToCamp`
// qu'il redescend l'attendre au camp, `enter`, au terme, qu'il ouvre le combat.
import type { DoorView } from '~~/server/utils/game'
import { introFor } from '~~/utils/bossIntros'
import type { BossStage } from '~~/utils/bossStage'

const props = defineProps<{ stage: BossStage, door: DoorView }>()

const emit = defineEmits<{ placeKey: [], openDoor: [], descendToCamp: [], enter: [] }>()

const assets = useBossAssetsLoadingScreen(props.stage.floor)
// Les battants s'écartent au clic, sans attendre le serveur : il retient le
// geste pour le retour, l'animation n'a pas à l'attendre.
const opened = ref(props.door.opened)
const introPlaying = ref(false)
/** Entière au premier combat, une réplique de relance aux suivants. */
const intro = computed(() => introFor(props.stage.intro, props.door.bossAttemptNumber))

function openDoor(): void {
  opened.value = true
  emit('openDoor')
}

/** « Entrer » : l'introduction s'il y en a une pour ce combat, sinon le combat tout de suite. */
function enter(): void {
  if (intro.value) {
    introPlaying.value = true
  }
  else {
    emit('enter')
  }
}
</script>
