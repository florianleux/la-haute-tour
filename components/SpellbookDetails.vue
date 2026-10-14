<template>
  <div>
    <!-- Le dessin et le nom, sur 68,6 % de la largeur : le dessin garde sa
         taille, et la marge laisse aux textes des faces la place de s'étaler
         sous leur rond. -->
    <div class="mx-auto w-[68.6%]">
      <!-- Le nom, centré sur le rond du haut (48,6 % du dessin), pas sur la
           page. -->
      <p class="                                                                              -mt-3 ml-[48.6%] w-max -translate-x-1/2 text-4xl font-bold motion-safe:animate-ink-in [--enter-delay:0s]">
        {{ spellLabel(spell) }}
      </p>
      <!-- Ses exemplaires en poche, sous le nom et centrés comme lui. -->
      <p class="ml-[48.6%] w-max -translate-x-1/2 font-medium motion-safe:animate-ink-in [--enter-delay:0.03s]">
        {{ count ? `${count} exemplaire${count > 1 ? 's' : ''}` : 'Aucun exemplaire' }}
      </p>

      <!-- Les trois ronds dessinés (public/images/spellbook-right-rounds.webp,
           494×270, rogné par scripts/img-trim-webp.sh) : en haut le sort, à
           gauche sa magie blanche, à droite sa magie noire. Chaque médaillon
           tient dans son rond. `@container` : l'étincelle de repli se mesure
           sur la largeur du dessin. -->
      <div class="@container relative mt-4 aspect-[494/270] motion-safe:animate-ink-in [--enter-delay:0.06s]">
        <img
          src="/images/spellbook-right-rounds.webp"
          alt=""
          class="pointer-events-none absolute inset-0 size-full select-none"
        >
        <SpellMedallion
          v-for="round in ROUNDS"
          :key="round.face"
          :spell="spell"
          :face="round.face"
          class="absolute -translate-x-1/2 -translate-y-1/2 [filter:drop-shadow(0_2px_3px_rgb(0_0_0/0.35))]"
          :style="{ left: round.left, top: round.top, width: round.width }"
          fallback-class="border-2 border-pentacle/60 text-[11cqw] text-pentacle"
        />
      </div>
    </div>

    <!-- Sous chaque rond du bas, sa face et ce qu'elle fait, centrées sur son
         médaillon. Un sort en poche n'a pas encore de face : celle qu'il
         prendra dépend de la cible. Voir specs/bonus.md#catégories-de-cible. -->
    <dl class="mt-5 flex text-center motion-safe:animate-ink-in [--enter-delay:0.12s]">
      <div
        v-for="face in SPELL_FACES"
        :key="face"
        class="w-[49.8%] px-2"
        :class="FACE_COLUMNS[face]"
      >
        <dt>
          <SpellFaceTag :face="face" class="text-xs" />
        </dt>
        <dd class="mt-1">
          {{ spellEffects(spell)[face] }}
        </dd>
      </div>
    </dl>
  </div>
</template>

<script setup lang="ts">
// Le sort choisi, en tête de la page droite du Grimoire : son nom et ses
// exemplaires en poche, ses trois médaillons dans les ronds dessinés, et ce que
// fait chacune de ses faces. Il apparaît à l'encre, en cascade ; le Grimoire le
// remonte à chaque sort choisi. L'infobulle d'un sort garde son dessin compact
// (SpellDetails). Voir specs/ecrans.md#sorts.
import { SPELL_FACES } from '~~/shared/utils/spells'
import type { SpellFace, SpellId } from '~~/shared/utils/spells'
import type { SpellImageVariant } from '~~/utils/spells'

defineProps<{
  spell: SpellId
  /** Ses exemplaires en poche. */
  count: number
}>()

/**
 * Un médaillon par rond : son centre et sa largeur, en % de la boîte du
 * dessin, relevés sur l'image. Le diamètre intérieur des ronds fait 29 % (en
 * haut) et 25 % (en bas) de la largeur : le médaillon y tient, un peu en
 * retrait du trait.
 */
const ROUNDS: { face: SpellImageVariant, left: string, top: string, width: string }[] = [
  { face: 'mixed', left: '48.6%', top: '28.2%', width: '25%' },
  { face: 'boon', left: '13.8%', top: '74.8%', width: '22%' },
  { face: 'curse', left: '86.6%', top: '71.7%', width: '22%' },
]

/**
 * La colonne de chaque face, centrée sous son rond. Le dessin occupe 68,6 % de
 * la largeur, centré : ses ronds du bas tombent à 15,7 + 0,686 × 13,8 ≈ 25,2 %
 * et 15,7 + 0,686 × 86,6 ≈ 75,1 % de la page. Larges de 49,8 % — deux fois
 * l'écart du rond de droite au bord —, les colonnes s'y centrent sans déborder,
 * presque une moitié de page chacune. Un rond qui bouge dans ROUNDS, ou le
 * dessin qui change de largeur, se recalcule ici.
 */
const FACE_COLUMNS: Record<SpellFace, string> = {
  boon: 'ml-[0.3%]',
  curse: 'ml-auto',
}
</script>
