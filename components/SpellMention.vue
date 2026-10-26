<template>
  <!-- Le sort se lit comme un mot de la phrase, suivi de son médaillon. Le
       pointillé dit qu'un survol en dit plus, comme une abréviation expliquée.
       Tailles en em : la mention suit le texte où elle se pose. Alignée sur la
       ligne de base du texte, seule l'icône se centre. -->
  <SpellTooltip
    :subject="subject"
    class="cursor-help"
  >
    <span class="inline-flex items-baseline gap-[0.3em]">
      <span class="underline decoration-current/50 decoration-dotted decoration-[0.1em] underline-offset-[0.2em]">
        {{ spellLabel(spell) }}
      </span>
      <SpellMedallion
        :spell="spell"
        :face="effect?.face ?? 'mixed'"
        :alt="effect ? `lancé par ${effect.casterName}` : ''"
        class="w-[1.5em] self-center"
        shadow-class="shadow-[0_1px_2px_rgb(0_0_0/0.35)]"
        fallback-class="border border-current/40 text-[0.75em]"
      />
    </span>
  </SpellTooltip>
</template>

<script setup lang="ts">
// Un sort nommé dans un texte de parchemin : l'effet posé sur le joueur, ou le
// sort qu'un coffre vient de donner. Écrit une fois pour les deux. Le nom du
// lanceur ne s'écrit pas dans la phrase : il se lit au survol, et par la
// synthèse vocale dans le texte de l'icône, que specs/bonus.md exige lisible.
import type { SpellSubject } from '~~/utils/spells'

const props = defineProps<{ subject: SpellSubject }>()

const spell = computed(() => splitSubject(props.subject).spell)
const effect = computed(() => splitSubject(props.subject).effect)
</script>
