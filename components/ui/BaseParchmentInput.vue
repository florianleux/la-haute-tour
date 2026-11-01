<template>
  <input
    id="answer"
    ref="field"
    :value="modelValue"
    placeholder="Ta réponse..."
    type="text"
    autocomplete="off"
    :maxlength="ANSWER_MAX_LENGTH"
    class="w-[88%] rounded border bg-white px-[2.9cqw] py-[2.35cqw] text-center text-[7.1cqw] placeholder:italic focus:outline-none sm:w-[76%] sm:text-[3.5cqw]"
    :class="TONES[tone]"
    @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    @keydown.enter.prevent="$emit('submit')"
  >
</template>

<script setup lang="ts">
// Le champ de réponse du thème parchemin, en ascension comme en rattrapage : on
// répond de la même façon des deux côtés. Tailles en cqw du panneau, comme
// PlayText — voir PlayFrame pour le @container.
//
// Ce n'est pas un BaseInput : celui-là est un champ de formulaire — intitulé,
// allures sombre ou claire de BaseField, tailles fixes —, et le recouvrir en
// ligne est ce que CLAUDE.md interdit. Ici, ni intitulé ni formulaire : tailles
// en cqw, Entrée qui répond. Même rôle, deux natures, donc deux composants — le
// partage que BaseCardButton fait déjà avec BaseButton et BaseParchmentNote
// avec BaseHint.
//
// L'`id="answer"` est écrit ici parce qu'il ne désigne rien d'autre : c'est lui
// que PlayFrame guette (`group-has-[#answer:focus]`) pour remonter le panneau
// quand le clavier virtuel s'ouvre. Un seul champ à l'écran à la fois, jamais
// deux cartes montées ensemble.
import { ANSWER_MAX_LENGTH } from '~~/shared/utils/answers'

withDefaults(defineProps<{
  modelValue: string
  /** Ses couleurs : le parchemin du jeu, ou les lunes de l'épreuve du boss de l'étage 1. */
  tone?: 'parchment' | 'moon'
}>(), { tone: 'parchment' })

const TONES = {
  parchment: 'border-[#d2860070] text-amber-800 placeholder:text-[#ecd6b3] focus:border-amber-0',
  moon: 'border-[#C1FFFE] text-[#0D304E] placeholder:text-[#2B8390]/50',
} as const

defineEmits<{ 'update:modelValue': [string], submit: [] }>()

const field = useTemplateRef<HTMLInputElement>('field')

// Le focus auto ouvre le clavier physique sans y toucher — utile sur desktop,
// où Entrée enchaîne les questions sans jamais en sortir. Sur mobile, il n'y a
// pas de clavier physique : ce même focus ouvrirait le clavier virtuel tout
// seul à chaque question, ce que personne n'a demandé. Seuil aligné sur les
// classes `sm:` du reste des écrans de jeu.
onMounted(() => {
  if (window.matchMedia('(min-width: 640px)').matches) {
    field.value?.focus()
  }
})
</script>
