<template>
  <p
    class="text-[2.2cqw] italic"
    :class="TONE_INK[tone]"
  >
    <slot />
  </p>
</template>

<script setup lang="ts">
// Une ligne de commentaire sur un parchemin : rappel, résultat, état. Les écrans
// reskinés en parchemin (WaitCard, et les suivants) en empilent plusieurs, toutes
// de la même taille et du même italique — les recopier en ligne à chaque fois est
// ce que CLAUDE.md interdit.
//
// Ce n'est pas un BaseHint : celui-ci porte le thème sombre et son propre fond,
// et le recouvrir en ligne serait le même interdit. Même rôle, deux thèmes, donc
// deux composants — c'est déjà le partage que BaseCardButton fait avec BaseButton.
//
// Les encres sont plus sourdes que celles de utils/tone.ts, écrites pour du texte
// clair sur fond sombre : sur un parchemin, `text-rose-400` disparaîtrait.
import type { Tone } from '~~/utils/tone'

const TONE_INK: Record<Tone, string> = {
  neutral: 'text-amber-900/60',
  success: 'text-emerald-900/80',
  danger: 'text-rose-900/80',
  warning: 'text-amber-900/80',
}

withDefaults(defineProps<{ tone?: Tone }>(), { tone: 'neutral' })
</script>
