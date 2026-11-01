<template>
  <!-- La nuit de l'arène qui monte sur elle, sans clic, une fois le verdict lu.
     - Gagné : Julien bras dans le dos, en colère d'avoir perdu ; « Gardien
       vaincu » puis « VICTOIRE », l'or du nom du boss à l'introduction, le
       pendant du « DÉFAITE » rouge ; puis sa réplique, qu'un clic ou Entrée
       enchaîne.
     - Passé : pas de titre. Julien bras dans le dos, sérieux, qui laisse
       monter le joueur par respect ; sa réplique et « Continuer ». -->
  <BossOutroScene
    :boss="boss"
    pose="back"
    :expression="won ? 'angry' : 'stern'"
    :remark="won ? boss.victoryLine : boss.passLine"
    :backdrop="BOSS_NIGHT"
    :colors="colors"
    :figure-box="figureBox"
    :gestures="won ? undefined : [{ label: 'Continuer', run: () => emit('next') }]"
    :hold-ms="1000"
    :title-ms="won ? TITLE_LEAD_MS + TITLE_SHOWN_MS : PASS_SHOWN_MS"
    :veiled="veiled"
    advance-on-enter
    @advance="emit('next')"
  >
    <template
      v-if="won"
      #title
    >
      <div class="contents [--title-ms:10s]">
        <p
          class="-mb-[0.4cqw] text-[1.4cqw] leading-none"
          :class="TITLE_GOLD"
        >
          Gardien vaincu
        </p>
        <p
          class="text-[5.5cqw]"
          :class="TITLE_GOLD"
          :style="{ animationDelay: `${TITLE_LEAD_MS}ms` }"
        >
          Victoire
        </p>
        <div
          :class="TITLE_RULE"
          :style="{ animationDelay: `${TITLE_LEAD_MS}ms` }"
        />
      </div>
    </template>
  </BossOutroScene>
</template>

<script setup lang="ts">
// L'outro de victoire (specs/spec.md#glossaire, Outro de victoire) : le combat
// gagné ou passé, avant la relique et le palier. Rien ne s'y joue côté
// serveur : son geste est celui qu'aurait eu le verdict. La page lui laisse
// Entrée (victoryOnScreen).
import { BOSS_NIGHT } from '~~/utils/backdrop'
import { TITLE_GOLD, TITLE_RULE } from '~~/utils/typography'
import type { BossEntry } from '~~/utils/bosses'

const props = defineProps<{
  boss: BossEntry
  outcome: 'victory' | 'passed'
  /** Les couleurs de sa fenêtre, celles de son introduction ; absentes, celles du joueur. */
  colors?: string
  /** Sa place à l'introduction (`figureBox` de bossIntros). */
  figureBox?: string
  /** L'écran de la relique par-dessus : la nuit reste, la scène s'efface. */
  veiled?: boolean
}>()

const emit = defineEmits<{ next: [] }>()

const won = computed(() => props.outcome === 'victory')

/** L'épithète se révèle la première, le titre la suit. */
const TITLE_LEAD_MS = 2000
/** Le titre révélé, reflet compris (70 % de --title-ms) : la réplique vient ensuite. */
const TITLE_SHOWN_MS = 7000
/** Passé, sans titre : le boss paru, à moitié de son fondu, avant sa réplique. */
const PASS_SHOWN_MS = 1500
</script>
