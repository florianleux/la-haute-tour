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
      <div class="relative mt-4 aspect-[494/270]">
        <!-- L'encre dans sa propre boîte, à côté de la pièce du lancer et non
             autour : son animation en fait un contexte d'empilement, et la
             vignette du lancer y serait prise, sous le reste de la page. -->
        <div class="@container absolute inset-0 motion-safe:animate-ink-in [--enter-delay:0.06s]">
          <img
            src="/images/spellbook-right-rounds.webp"
            alt=""
            class="pointer-events-none absolute inset-0 size-full select-none"
          >
          <!-- Pendant un lancer, le médaillon de la face lancée cède la place
               à la pièce qui se charge ; il revient en fondu une fois qu'elle
               est partie. -->
          <template v-for="round in ROUNDS" :key="round.face">
            <SpellMedallion
              v-if="round.face !== burst?.face"
              :spell="spell"
              :face="round.face"
              class="absolute -translate-x-1/2 -translate-y-1/2 [filter:drop-shadow(0_2px_3px_rgb(0_0_0/0.35))]"
              :class="{ 'motion-safe:animate-fade-in': round.face !== 'mixed' }"
              :style="{ left: round.left, top: round.top, width: round.width }"
              fallback-class="border-2 border-spell-page/60 text-[11cqw] text-spell-page"
            />
          </template>
        </div>

        <!-- Au-dessus de tout le livre : sa vignette éteint le reste, et la
             pièce part de son rond vers le centre de l'écran. Voir
             components/SpellCastBurst.vue. -->
        <SpellCastBurst
          v-if="burst && burstRound"
          :cast="burst"
          class="absolute z-20 -translate-x-1/2 -translate-y-1/2"
          :style="{ left: burstRound.left, top: burstRound.top, width: burstRound.width }"
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
import type { SpellCast } from '~~/composables/useSpellCast'

const props = withDefaults(defineProps<{
  spell: SpellId
  /** Ses exemplaires en poche. */
  count: number
  /** Le lancer en cours d'animation, null au repos. Voir composables/useSpellCast.ts. */
  cast?: SpellCast | null
}>(), { cast: null })

/** Le lancer, s'il est celui de ce sort : un autre choisi entre-temps n'a pas à le jouer. */
const burst = computed(() => (props.cast?.spell === props.spell ? props.cast : null))

/** Le rond de la face lancée : c'est sa pièce qui se charge. */
const burstRound = computed(() => ROUNDS.find(round => round.face === burst.value?.face))

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
