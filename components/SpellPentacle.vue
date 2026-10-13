<template>
  <!-- Posé sur toute la boîte du livre : les ronds se placent en % de lui, sur
       ceux du pentacle dessiné dans public/images/spellbook.webp. -->
  <div class="pointer-events-none absolute inset-0">
    <div
      v-for="spell in SPELL_IDS"
      :key="spell"
      class="@container pointer-events-auto absolute aspect-square w-[6.6%] -translate-x-1/2 -translate-y-1/2"
      :style="ROUNDS[spell]"
    >
      <!-- Découvert : son médaillon, et tout le rond qui le choisit. Le choisi
           grossit et brille de l'or des étincelles du livre. -->
      <template v-if="discovered.includes(spell)">
        <SpellMedallion
          :spell="spell"
          face="mixed"
          class="size-full transition-transform duration-200"
          :class="selected === spell
            ? 'scale-110 [filter:drop-shadow(0_0_4px_#fde68a)_drop-shadow(0_0_12px_#f59e0b)]'
            : 'hover:scale-105 [filter:drop-shadow(0_2px_3px_rgb(0_0_0/0.35))]'"
          fallback-class="border-2 border-red-500/60 text-[50cqw] text-red-500"
        />
        <BaseSurfaceButton
          :label="spellLabel(spell)"
          :aria-pressed="selected === spell"
          @click="selected = spell"
        />
      </template>

      <!-- Pas encore obtenu : un point d'interrogation, et rien à choisir.
           Provisoire, tracé au texte dans le rouge du pentacle ; un dessin le
           remplacera. -->
      <span
        v-else
        role="img"
        aria-label="Sort pas encore découvert"
        class="flex size-full -rotate-6 select-none items-center justify-center text-[70cqw] font-bold leading-none text-red-500/85"
      >?</span>
    </div>
  </div>
</template>

<script setup lang="ts">
// Le pentacle du Grimoire : un rond par sort du catalogue. Voir
// specs/ecrans.md#sorts.
import { SPELL_IDS } from '~~/shared/utils/spells'
import type { SpellId } from '~~/shared/utils/spells'

defineProps<{
  /** Les sorts obtenus au moins une fois : eux seuls montrent leur médaillon. */
  discovered: SpellId[]
}>()

/** Le sort que la page droite montre, null tant que rien n'est choisi. */
const selected = defineModel<SpellId | null>({ required: true })

/**
 * Le centre de chaque rond, en % de la boîte du livre, relevé sur l'image. Ordre
 * du catalogue, en partant du haut, dans le sens des aiguilles d'une montre. Un
 * sort par rond, tous : un sort ajouté au catalogue ne compile pas sans le sien.
 */
const ROUNDS: Record<SpellId, { left: string, top: string }> = {
  VITALITY: { left: '29.3%', top: '32.6%' },
  RESPITE: { left: '41%', top: '46.3%' },
  CHRONOMANCY: { left: '39.1%', top: '70.1%' },
  INDULGENCE: { left: '15.3%', top: '69.6%' },
  PURGE: { left: '14.8%', top: '45.8%' },
}
</script>
