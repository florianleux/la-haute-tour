<template>
  <CampOverlay v-slot="{ closing, close }" label="Haut-faits" @close="$emit('close')">
    <!-- Par-dessus le camp (CampOverlay), comme le Volumen et le Grimoire.
         Clic à côté de la bannière = fermer.

         La bannière garde ses proportions (public/images/achievements-banner-*.webp,
         1292×1849, rognée par scripts/img-trim-webp.sh) : jamais étirée, au
         plus haut qui tienne. Son haut est coupé au ras de l'image : elle pend
         du bord de l'écran, accrochée hors champ. Pivot en haut, à son point
         d'accroche. Les positions en % sont relevées sur l'image. -->
    <div
      class="relative aspect-[1292/1849] h-[min(92dvh,calc(96vw*1849/1292))] shrink-0 origin-top"
      :class="closing ? 'motion-safe:animate-banner-lift' : 'motion-safe:animate-banner-drop'"
      @click.self="close"
    >
      <img
        :src="BANNERS[team]"
        alt=""
        class="pointer-events-none absolute inset-0 size-full select-none"
      >

      <!-- L'étoffe attrape ses clics : seul le vide autour ferme, y compris
           l'échancrure entre ses deux pointes. Elle couvre d'une couture à
           l'autre, jusqu'au bas des emblèmes. -->
      <div class="absolute inset-x-[3%] top-0 h-[70%]" />

      <!-- Le titre et le compteur, posés sur l'étoffe, en haut, dans l'éclat
           des noms du camp. Ils jaillissent pendant que la bannière rebondit.
           Le compteur passe dessous, plus petit : sur une seule ligne, il
           débordait de l'étoffe. -->
      <CampOverlayTitle :closing="closing" delay="0.35s" class="top-[21%]">
        Haut-faits
        <span class="block text-[0.4em]">{{ unlockedCount }} / {{ catalogue.length }}</span>
      </CampOverlayTitle>

      <div class="pointer-events-none absolute inset-0" v-bind="fadeLayer(closing, '0.6s')">
        <BaseCloseButton
          label="Fermer les Haut-faits"
          class="pointer-events-auto absolute right-[9%] top-[2%] z-10"
          @click="close"
        />

        <BaseNotice v-if="failed" class="pointer-events-auto absolute inset-x-[12%] top-[21.5%]">
          Tes succès n'ont pas pu être lus. Recharge la page.
        </BaseNotice>

        <!-- Le mur, entre les coutures, du titre jusqu'au-dessus des
             emblèmes. Dix colonnes à toutes les tailles : les tuiles suivent
             la bannière, et les cinquante tiennent sans défiler — une boîte
             qui défile couperait les infobulles du premier rang. -->
        <div
          v-else
          class="pointer-events-auto absolute inset-x-[12%] bottom-[51%] top-[21.5%] grid grid-cols-10 content-center gap-[0.5%]"
        >
          <AchievementTile
            v-for="id in catalogue"
            :id="id"
            :key="id"
            :unlocked-at="unlockedAt.get(id) ?? null"
          />
        </div>
      </div>
    </div>
  </CampOverlay>
</template>

<script setup lang="ts">
// Les Haut-faits : le mur des succès, sur la bannière de la guilde du joueur,
// au camp et là seulement, ouvert par-dessus lui. Voir specs/ecrans.md#haut-faits.
import { ACHIEVEMENT_IDS } from '~~/shared/utils/achievements'
import type { TeamId } from '~~/shared/utils/teams'

defineEmits<{ close: [] }>()

/** La bannière de chaque guilde : bleue aux étoiles, rouge au livre. */
const BANNERS: Record<TeamId, string> = {
  MIDI: '/images/achievements-banner-midi.webp',
  TLM: '/images/achievements-banner-tlm.webp',
}

const { user } = await useCurrentUser()

// Sans équipe, pas de bannière : celle du camp, qui ouvre cette boîte, n'est
// pas posée. La boîte ne se demande pas une seconde fois s'il en a une.
const team = computed(() => user.value!.team!)

const { unlockedAt, failed } = await useAchievements()

// Le mur suit l'ordre du catalogue : les premières fois d'abord, puis ce qui se
// gagne en montant, et les curiosités à la fin.
const catalogue = ACHIEVEMENT_IDS
const unlockedCount = computed(() => unlockedAt.value.size)
</script>
