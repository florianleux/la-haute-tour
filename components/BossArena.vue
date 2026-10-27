<template>
  <div class="contents">
    <!-- Nuit bleue par-dessus le ciel de PlayFrame : le combat n'a pas de décor. -->
    <div class="fixed inset-0 z-1 bg-[#070d24]" />

    <!-- Le boss, à gauche, dans sa pose d'arène, à sa place (`arena.box`).
         Il encaisse en colère, et rit de chaque coup du joueur. -->
    <BossFigure
      :figure="boss.figure"
      :pose="boss.arena.pose"
      :expression="expression"
      :talking="hurt !== null"
      class="pointer-events-none fixed bottom-0 z-5"
      :class="[boss.arena.box, hurt === 'boss' && 'motion-safe:animate-hit']"
    />

    <!-- Le joueur, à droite, plus petit que le boss et retourné pour lui faire
         face. Il encaisse chaque faute, et rougit le temps du coup. -->
    <div
      class="pointer-events-none fixed bottom-0 right-[4vw] z-5 h-[38dvh]"
      :class="hurt === 'player' && 'motion-safe:animate-hit'"
    >
      <img
        :src="portrait"
        alt=""
        class="h-full w-auto -scale-x-100 transition-[filter] duration-300"
        :class="hurt === 'player' && 'drop-shadow-[0_0_1.5rem_rgb(220_38_38)]'"
      >
    </div>

    <!-- La vie du joueur, en cases, à la hauteur de celle du boss. -->
    <HealthBar
      :name="playerName"
      :value="lives"
      :max="maxLives"
      segmented
      class="fixed bottom-[5dvh] right-[4vw] z-20 w-[20vw] text-right text-2xl"
    />

    <!-- La vie du boss : une longue barre qui part de dessus le boss et
         s'arrête avant le joueur. -->
    <HealthBar
      :name="boss.name"
      :value="bossHp"
      :max="bossMaxHp"
      class="fixed bottom-[5dvh] left-[3vw] right-[31vw] z-20 text-[2rem]"
    />

    <!-- L'épreuve du combat, propre à chaque boss, au milieu. -->
    <slot />
  </div>
</template>

<script setup lang="ts">
// L'arène d'un combat de boss (specs/boss.md) : le boss et le joueur face à
// face, leurs barres de vie, leurs coups. La même pour tous les boss ; seule
// l'épreuve au milieu change, dans le slot. L'arène ne compte rien : l'écran du
// combat lui donne les vies, et chaque vie perdue d'un côté est un coup
// encaissé de ce côté-là.
import type { BossEntry, BossExpression } from '~~/utils/bosses'

const props = defineProps<{
  boss: BossEntry
  bossHp: number
  bossMaxHp: number
  playerName: string
  portrait: string
  lives: number
  maxLives: number
}>()

/** Le temps d'un coup encaissé : la secousse (`animate-hit`) et le halo. */
const HURT_MS = 900
/** Sa tête quand il encaisse, puis quand le joueur encaisse. */
const REACTION: Record<'boss' | 'player', BossExpression> = { boss: 'angry', player: 'laugh' }

const hurt = ref<'boss' | 'player' | null>(null)
const expression = computed(() => (hurt.value ? REACTION[hurt.value] : 'stern'))

let timer: ReturnType<typeof setTimeout> | undefined

function strike(target: 'boss' | 'player'): void {
  clearTimeout(timer)
  hurt.value = target
  timer = setTimeout(() => {
    hurt.value = null
  }, HURT_MS)
}

// Une vie qui baisse est un coup ; une vie qui remonte (combat rejoué) n'en est pas un.
watch(() => props.bossHp, (now, before) => now < before && strike('boss'))
watch(() => props.lives, (now, before) => now < before && strike('player'))

onBeforeUnmount(() => clearTimeout(timer))
</script>
