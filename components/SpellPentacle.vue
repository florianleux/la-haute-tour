<template>
  <!-- Posé sur toute la boîte du livre : les ronds se placent en % de lui, sur
       ceux du pentacle dessiné dans public/images/spellbook.webp. -->
  <div class="pointer-events-none absolute inset-0">
    <div
      v-for="spell in SPELL_IDS"
      :key="spell"
      class="@container group pointer-events-auto absolute aspect-square w-[6.6%] -translate-x-1/2 -translate-y-1/2"
      :style="ROUNDS[spell]"
    >
      <!-- Découvert : son médaillon, et tout le rond qui le choisit. Le choisi
           grossit et brille de l'or des étincelles du livre. Le survol se lit
           sur le rond (`group`) : le bouton posé par-dessus le médaillon
           l'empêcherait d'être survolé lui-même.

           Au clic, un saut en dessin animé et une gerbe d'étincelles. Changer
           de clé remonte le médaillon et la gerbe : l'effet se rejoue à chaque
           clic, même sur le rond déjà choisi. -->
      <template v-if="discovered.includes(spell)">
        <SpellMedallion
          :key="`medallion-${picked?.spell === spell ? picked.key : 0}`"
          :spell="spell"
          face="mixed"
          class="size-full transition-[scale] duration-200 group-hover:scale-125"
          :class="[
            selected === spell
              ? 'scale-110 [filter:drop-shadow(0_0_4px_#fde68a)_drop-shadow(0_0_12px_#f59e0b)]'
              : '[filter:drop-shadow(0_2px_3px_rgb(0_0_0/0.35))]',
            picked?.spell === spell ? 'motion-safe:animate-spell-pick' : '',
          ]"
          fallback-class="border-2 border-red-500/60 text-[50cqw] text-red-500"
        />
        <SparkleSpray
          v-if="picked?.spell === spell"
          :key="`spray-${picked.key}`"
          :sparks="PICK_SPRAY"
          class="drop-shadow-[0_0_6px_#fde68a]"
        />
        <BaseSurfaceButton
          :label="spellLabel(spell)"
          :aria-pressed="selected === spell"
          @click="pick(spell)"
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

/** Le dernier clic sur un rond : quel sort, et une clé neuve qui rejoue l'effet. */
const picked = ref<{ spell: SpellId, key: number } | null>(null)

function pick(spell: SpellId): void {
  selected.value = spell
  picked.value = { spell, key: (picked.value?.key ?? 0) + 1 }
}

/**
 * La gerbe du clic : dix étincelles en couronne, deux longueurs, qui partent
 * au sommet du saut du médaillon (`animate-spell-pick`, 35 %). En cqw, sur la
 * largeur du rond.
 */
const PICK_SPRAY = Array.from({ length: 10 }, (_, index) => {
  const angle = ((index * 36 + (index % 2) * 14) * Math.PI) / 180
  const distance = index % 2 ? 60 : 90

  return {
    dx: `${Math.round(Math.cos(angle) * distance)}cqw`,
    dy: `${Math.round(Math.sin(angle) * distance)}cqw`,
    size: index % 2 ? '14%' : '20%',
    delay: `${(0.25 + (index % 3) * 0.04).toFixed(2)}s`,
  }
})

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
