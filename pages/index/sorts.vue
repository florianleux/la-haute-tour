<template>
  <CampOverlay v-slot="{ closing, close }" label="Grimoire" :game="game">
    <!-- Par-dessus le camp (CampOverlay), comme le Volumen. Clic à côté du
         livre = fermer.

         Le livre garde ses proportions (public/images/spellbook.webp,
         1828×1080) : jamais étiré, au plus large qui tienne, posé en bas de
         l'écran. Son bas tombe un peu dessous, comme celui du Volumen. Pas de
         version mobile pour l'instant. Les positions en % sont relevées sur
         l'image. -->
    <div
      class="relative -mb-[3dvh] mt-auto aspect-[1828/1080] w-[min(96vw,calc(90dvh*1828/1080))] shrink-0 origin-bottom"
      :class="closing ? 'motion-safe:animate-sink [--enter-delay:0.1s]' : 'motion-safe:animate-book-rise'"
      @click.self="close"
    >
      <img
        src="/images/spellbook.webp"
        alt=""
        class="pointer-events-none absolute inset-0 size-full select-none"
      >

      <!-- Le livre attrape ses clics : seul le vide autour ferme. Il couvre
           d'une couverture à l'autre, sous les onglets du haut. -->
      <div class="absolute inset-x-[1.5%] bottom-0 top-[10%]" />

      <!-- La page gauche : un rond par sort, médaillon une fois découvert. Le
           rond choisi dit quel sort la page droite montre. -->
      <SpellPentacle
        v-model="selected"
        :discovered="discovered"
        v-bind="fadeLayer(closing, '0.5s')"
      />

      <!-- La magie du livre : des étincelles partout dessus, qui s'allument
           une fois le livre posé. Un halo ambré au plus près les détache du
           papier clair. Elles tournent en boucle : la sortie ne les attend
           pas. -->
      <SparkleField
        :sparks="SPARKS"
        class="pointer-events-none [filter:drop-shadow(0_0_2px_#d97706)_drop-shadow(0_0_8px_#fde68a)]"
        v-bind="fadeLayer(closing, '0.6s')"
      />

      <!-- Le titre, au-dessus du livre, dans l'éclat des noms du camp : il
           jaillit pendant que le livre rebondit, comme celui du Volumen. -->
      <CampOverlayTitle :closing="closing" delay="0.35s" class="top-[6%]">
        Grimoire
      </CampOverlayTitle>

      <!-- La page droite. Le contenu y est posé tel quel en attendant le
           cadre rouge et l'historique du sort choisi (#76, #77) : il défile.
           Le lancer revient avec le cadre rouge. -->
      <div
        class="absolute bottom-[9%] left-[54%] right-[10%] top-[15%] flex flex-col"
        v-bind="fadeLayer(closing, '0.7s')"
      >
        <BaseCloseButton label="Fermer le Grimoire" class="absolute -right-2 -top-2 z-10" @click="close" />

        <div class="min-h-0 flex-1 overflow-y-auto pr-8 text-slate-900">
          <!-- Le budget de lancers de l'attente. Ses boutons reviennent avec le
               cadre rouge (#76), qui le posera sous eux. Voir
               specs/bonus.md#où-et-quand. -->
          <BaseHint :tone="castsLeft ? 'neutral' : 'warning'">
            <template v-if="castsLeft">
              Il te reste {{ castsLeft }} lancer{{ castsLeft > 1 ? 's' : '' }} pour
              cette attente.
            </template>
            <template v-else>
              Tu as dépensé tes {{ castsPerCooldown }} lancers : la prochaine attente
              t'en rendra autant.
            </template>
          </BaseHint>

          <!-- L'échéance de l'attente, qu'un Répit fait reculer. Voir
               specs/bonus.md#catalogue. -->
          <BaseHint v-if="cooldownRemaining" class="mt-4">
            Reprise dans {{ cooldownRemaining }}.
          </BaseHint>

          <BaseNotice v-if="failed">
            Impossible de lire ton inventaire. Recharge la page.
          </BaseNotice>

          <template v-else>
            <!-- Le journal : c'est là que le lanceur lit ce qu'il a envoyé, et quand.
                 Il survit à l'effet, qui meurt avec la tentative qu'il a ouverte. -->
            <BaseSection title="Ce que tu as lancé" class="mt-8">
              <BaseList class="mt-4" :empty="log.length ? null : 'Tu n\'as encore rien lancé.'">
                <li
                  v-for="(entry, index) in log"
                  :key="index"
                  class="flex items-baseline justify-between gap-4 px-4 py-3"
                >
                  <span class="font-medium">
                    {{ spellLabel(entry.spell) }} — sur {{ entry.targetName ?? 'personne' }}
                  </span>
                  <span class="text-sm text-slate-400">{{ formatDayTime(entry.castAt) }}</span>
                </li>
              </BaseList>
            </BaseSection>

            <!-- L'autre côté du même système : sans lui, personne ne saurait jamais
                 qu'un allié l'a soutenu. Voir specs/bonus.md#ce-que-voit-la-cible-et-ce-que-voit-le-lanceur. -->
            <BaseSection title="Ce que tu as reçu" class="mt-8">
              <BaseList class="mt-4" :empty="received.length ? null : 'Personne ne t\'a encore rien lancé.'">
                <li
                  v-for="(entry, index) in received"
                  :key="index"
                  class="flex items-baseline justify-between gap-4 px-4 py-3"
                >
                  <span class="font-medium">{{ spellLabel(entry.spell) }} — de {{ entry.casterName }}</span>
                  <span class="text-sm text-slate-400">{{ formatDayTime(entry.castAt) }}</span>
                </li>
              </BaseList>
            </BaseSection>
          </template>
        </div>
      </div>
    </div>
  </CampOverlay>
</template>

<script setup lang="ts">
// Le Grimoire : le pentacle des sorts et les deux journaux — au camp et là
// seulement, ouvert par-dessus lui. Voir specs/ecrans.md#sorts.
import type { SpellId } from '~~/shared/utils/spells'

definePageMeta({
  // Hors du camp, la page n'est pas atteignable — URL comprise. Le serveur
  // refuse déjà la lecture ; la garde épargne au joueur un écran qu'il ne
  // pourrait pas remplir. Voir middleware/camp.ts.
  middleware: 'camp',
})

const {
  discovered,
  log,
  received,
  failed,
  castsLeft,
  castsPerCooldown,
} = await useInventory()

/** Le sort choisi au pentacle : rien à l'ouverture. */
const selected = ref<SpellId | null>(null)

// L'état de jeu : l'échéance de l'attente, et la fermeture si la partie quitte
// le camp (CampOverlay).
const game = await useGameState()
const { state } = game

/**
 * La magie du livre : des étincelles semées sur toute sa surface, en % de sa
 * boîte, décalées dans le cycle pour ne jamais s'allumer ensemble.
 */
const SPARKS = [
  { left: '8%', top: '20%', size: '3.1%', delay: '0s' },
  { left: '18%', top: '62%', size: '4.1%', delay: '0.9s' },
  { left: '24%', top: '14%', size: '2.5%', delay: '0.4s' },
  { left: '31%', top: '41%', size: '4.8%', delay: '1.3s' },
  { left: '38%', top: '78%', size: '3.4%', delay: '0.2s' },
  { left: '44%', top: '24%', size: '2.7%', delay: '1.1s' },
  { left: '49%', top: '55%', size: '3.7%', delay: '0.6s' },
  { left: '53%', top: '9%', size: '4.4%', delay: '1.5s' },
  { left: '58%', top: '70%', size: '2.9%', delay: '0.3s' },
  { left: '64%', top: '33%', size: '3.9%', delay: '1s' },
  { left: '70%', top: '85%', size: '3.2%', delay: '0.7s' },
  { left: '76%', top: '18%', size: '2.5%', delay: '1.4s' },
  { left: '81%', top: '50%', size: '4.6%', delay: '0.1s' },
  { left: '88%', top: '29%', size: '3.4%', delay: '0.8s' },
  { left: '92%', top: '68%', size: '2.7%', delay: '1.2s' },
  { left: '3%', top: '46%', size: '3.6%', delay: '0.5s' },
  { left: '96%', top: '12%', size: '3.1%', delay: '1.6s' },
  { left: '14%', top: '88%', size: '4.2%', delay: '1.05s' },
]

// L'échéance se relit à la minute, comme les fiches de l'administration : c'est
// assez fin pour qu'aucun chiffre affiché ne soit faux, et le Répit la fait
// reculer d'un coup au retour du lancer.
const now = useClockTick()
const cooldownRemaining = computed(() =>
  (state.value?.cooldownUntil ? formatRemaining(state.value.cooldownUntil, now.value) : ''),
)
</script>
