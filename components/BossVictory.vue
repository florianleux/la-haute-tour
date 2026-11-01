<template>
  <!-- La nuit de l'arène qui monte sur elle, sans clic, une fois le verdict lu
       (animate-victory-fall). Par-dessus les barres de vie (z-25) : le combat
       est fini. Sous l'écran de la relique (`veiled`), la nuit seule : la
       scène se lirait à travers son voile. -->
  <div
    class="fixed inset-0 z-30 overflow-hidden @container-size motion-safe:animate-victory-fall"
    :class="BOSS_NIGHT"
    :style="{ '--night-hold': `${NIGHT_HOLD_MS}ms`, '--night-fall': `${NIGHT_FALL_MS}ms` }"
  >
    <!-- Gagné, le boss bras dans le dos, en colère d'avoir perdu : posé au bas de
         l'écran, à la taille de l'arène, comme pendant le combat. Hors de la
         scène 16:9, qui ne descend pas toujours jusqu'au bord. -->
    <BossFigure
      v-if="won"
      :figure="boss.figure"
      pose="back"
      expression="angry"
      :talking="false"
      class="absolute bottom-0 left-1/2 h-[71.3dvh] -translate-x-1/2 motion-safe:animate-fade-in"
      :style="{ '--enter-delay': `${NIGHT_MS}ms`, animationDuration: `${NIGHT_FALL_MS}ms` }"
    />

    <div :class="[BACKDROP_BOX, BACKDROP_COVER]">
      <div
        class="@container"
        :class="BACKDROP_SCENE"
      >
        <!-- Gagné : « Gardien vaincu » puis « VICTOIRE », l'or du nom du boss
             à l'introduction, révélés lentement une fois la nuit tombée, et
             qui restent — le pendant du « DÉFAITE » rouge. -->
        <template v-if="won">
          <div class="absolute inset-x-0 top-[6%] flex flex-col items-center [--title-ms:10s]">
            <p
              class="-mb-[0.4cqw] text-[1.4cqw] leading-none"
              :class="TITLE_GOLD"
              :style="{ animationDelay: `${NIGHT_MS}ms` }"
            >
              Gardien vaincu
            </p>
            <p
              class="text-[5.5cqw]"
              :class="TITLE_GOLD"
              :style="{ animationDelay: `${NIGHT_MS + TITLE_LEAD_MS}ms` }"
            >
              Victoire
            </p>
            <div
              :class="TITLE_RULE"
              :style="{ animationDelay: `${NIGHT_MS + TITLE_LEAD_MS}ms` }"
            />
          </div>

          <!-- Sa réplique, une fois le titre révélé, sans geste : un clic sur
               la fenêtre enchaîne, comme une réplique de l'introduction, et
               Entrée aussi. -->
          <BaseDialogueWindow
            v-if="speaks"
            :remark="boss.victoryLine"
            :colors="colors"
            class="absolute bottom-[5%] left-1/2 w-[51%] -translate-x-1/2 cursor-pointer motion-safe:animate-fade-in"
            @click="emit('next')"
          />
        </template>

        <!-- Passé : pas de titre. Le boss bras dans le dos, sérieux, qui laisse monter
             le joueur par respect. -->
        <template v-else-if="!veiled">
          <BossFigure
            :figure="boss.figure"
            pose="back"
            expression="stern"
            :talking="false"
            class="absolute left-1/2 top-[22%] w-[42%] -translate-x-1/2"
          />

          <BaseDialogueWindow
            v-if="speaks"
            :remark="boss.passLine"
            :colors="colors"
            :gestures="[{ label: 'Continuer', run: () => emit('next') }]"
            class="absolute bottom-[5%] left-1/2 w-[51%] -translate-x-1/2"
          />
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// L'outro de victoire (specs/spec.md#glossaire, Outro de victoire) : le combat
// gagné ou passé, avant la relique et le palier. Rien ne s'y joue côté
// serveur : son geste est celui qu'aurait eu le verdict.
import { BACKDROP_BOX, BACKDROP_COVER, BACKDROP_SCENE, BOSS_NIGHT } from '~~/utils/backdrop'
import { TITLE_GOLD, TITLE_RULE } from '~~/utils/typography'
import type { BossEntry } from '~~/utils/bosses'

const props = defineProps<{
  boss: BossEntry
  outcome: 'victory' | 'passed'
  /** Les couleurs de sa fenêtre, celles de son introduction ; absentes, celles du joueur. */
  colors?: string
  /** L'écran de la relique par-dessus : la nuit reste, la scène s'efface. */
  veiled?: boolean
}>()

const emit = defineEmits<{ next: [] }>()

/** Gagné, et pas sous l'écran de la relique : les titres, Julien en colère et sa réplique. */
const won = computed(() => !props.veiled && props.outcome === 'victory')

/** Le verdict lu, avant que la nuit ne monte (délai d'animate-victory-fall). */
const NIGHT_HOLD_MS = 1000
/** La nuit qui monte (durée d'animate-victory-fall), et Julien avec elle. */
const NIGHT_FALL_MS = 2500
/** La nuit tombée. */
const NIGHT_MS = NIGHT_HOLD_MS + NIGHT_FALL_MS
/** L'épithète se révèle la première, le titre la suit. */
const TITLE_LEAD_MS = 2000
/** Le titre révélé, reflet compris (70 % de --title-ms) : la réplique vient ensuite. */
const TITLE_SHOWN_MS = 7000

// La fenêtre du boss attend la nuit tombée, et gagné, son titre : montée tout
// de suite, elle paraîtrait sous la nuit encore transparente, et un clic ou
// Entrée la passerait. La page lui laisse Entrée (victoryOnScreen).
const speaks = ref(false)
let speech: ReturnType<typeof setTimeout> | undefined
onMounted(() => {
  speech = setTimeout(() => {
    speaks.value = true
  }, props.outcome === 'victory' ? NIGHT_MS + TITLE_LEAD_MS + TITLE_SHOWN_MS : NIGHT_MS)
})
onBeforeUnmount(() => clearTimeout(speech))

useAdvanceOnEnter(() => emit('next'), () => speaks.value && !props.veiled)
</script>
