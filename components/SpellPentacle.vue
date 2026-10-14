<template>
  <!-- Posé sur toute la boîte du livre : les ronds se placent en % de lui, sur
       ceux du pentacle dessiné dans public/images/spellbook.webp. -->
  <div class="pointer-events-none absolute inset-0">
    <div
      v-for="spell in SPELL_IDS"
      :key="spell"
      class="@container group pointer-events-auto absolute aspect-square w-[6.6%] -translate-x-1/2 -translate-y-1/2"
      :style="{ left: ROUNDS[spell].left, top: ROUNDS[spell].top }"
    >
      <!-- Découvert : son médaillon, et tout le rond qui le choisit. Le
           choix se dit au crayon, comme tout le dessin de la page : un bout
           d'arc esquissé au survol, le cercle repassé en entier et ses rayons
           sur le choisi. Les autres pâlissent, à leur taille de repos : leur
           rond reste rempli. Le survol se lit sur le rond (`group`) — le
           bouton posé par-dessus le médaillon l'empêcherait d'être survolé
           lui-même — et le focus clavier fait le même effet.

           Le choisi, à l'échelle 1, recouvre le rond dessiné, trait rouge
           compris (Ø 110 px sur l'image, la boîte en fait 120). Les autres
           tiennent dedans (Ø 100 px), réduits, survol compris. Un `scale`
           au-dessus de 1 étire le rendu déjà rastérisé, et l'image sort floue.
           `will-change` fige ce rendu à la taille du médaillon, plafond de tous
           ses états.

           La pastille de ses exemplaires est posée sur le médaillon, dans la
           même boîte : elle suit sa taille, son rebond et son fondu.

           Au clic, un petit rebond, et le cercle se repasse. Seuls le
           médaillon et le cercle cliqués changent de clé : remontés, ils
           rejouent l'effet, même déjà choisis. Les autres, gardés, passent
           d'un état à l'autre en fondu. -->
      <template v-if="discovered.includes(spell)">
        <CrayonRing
          :key="replays[spell]"
          :drawn="selected === spell"
          :facing="ROUNDS[spell].facing"
          class="absolute -left-[30%] -top-[30%] size-[160%] text-pentacle"
        />
        <div
          :key="replays[spell]"
          class="absolute inset-0 [will-change:transform,scale] transition-[scale,filter,opacity] duration-200 motion-reduce:transition-none"
          :class="[
            selected === spell
              ? 'motion-safe:animate-spell-pick'
              : 'scale-[0.73] drop-shadow-[0_2px_3px_rgb(0_0_0/0.35)] group-hover-or-focus:scale-[0.78]',
            selected && selected !== spell
              ? 'opacity-60 grayscale-70 group-hover-or-focus:opacity-100 group-hover-or-focus:grayscale-0'
              : '',
          ]"
        >
          <SpellMedallion
            :spell="spell"
            face="mixed"
            class="size-full"
            fallback-class="border-2 border-pentacle/60 text-[50cqw] text-pentacle"
          />
          <SpellCountBadge :count="counts[spell] ?? 0" />
        </div>
        <BaseSurfaceButton
          :label="spellLabel(spell)"
          :aria-pressed="selected === spell"
          class="rounded-full"
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
        class="flex size-full -rotate-6 select-none items-center justify-center text-[70cqw] font-bold leading-none text-pentacle/85"
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
  /** Les exemplaires en poche, par sort : la pastille de chaque médaillon. Absent, zéro. */
  counts: Partial<Record<SpellId, number>>
}>()

/** Le sort que la page droite montre, null tant que rien n'est choisi. */
const selected = defineModel<SpellId | null>({ required: true })

/** Combien de fois chaque rond a été cliqué : sa clé, qui remonte son médaillon et rejoue l'effet. */
const replays = ref<Partial<Record<SpellId, number>>>({})

function pick(spell: SpellId): void {
  selected.value = spell
  replays.value[spell] = (replays.value[spell] ?? 0) + 1
}

/**
 * Chaque rond, relevé sur l'image. Vitalité au centre, les quatre autres aux
 * coins du carré, de haut à droite dans le sens des aiguilles d'une montre. Un
 * sort par rond, tous : un sort ajouté au catalogue ne compile pas sans le sien.
 */
const ROUNDS: Record<SpellId, {
  /** Le centre, en % de la boîte du livre. */
  left: string
  top: string
  /**
   * Le côté le plus dégagé, où le crayon esquisse son arc au survol : en
   * degrés depuis le haut, dans le sens des aiguilles d'une montre, mesuré en
   * pixels de l'image. Un coin regarde à l'opposé du centre, dans l'axe de sa
   * diagonale. Le centre regarde vers le plus large des creux que les
   * diagonales laissent autour de lui, environ 100° : l'esquisse
   * (`--crayon-hint`, components/CrayonRing.vue) y tient.
   */
  facing: number
}> = {
  VITALITY: { left: '28.3%', top: '55%', facing: 90 },
  RESPITE: { left: '41.7%', top: '28.2%', facing: 40 },
  CHRONOMANCY: { left: '41.5%', top: '83.1%', facing: 141 },
  INDULGENCE: { left: '14.6%', top: '81.9%', facing: -139 },
  PURGE: { left: '14.6%', top: '27.1%', facing: -40 },
}
</script>
