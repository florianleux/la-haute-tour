<template>
  <div class="fixed inset-0 z-0 bg-white bg-cover bg-center" />
  <!-- <div class="fixed inset-0 z-0 bg-[url(/images/play-bg.webp)] bg-cover bg-center" /> -->

  <div class="relative -mt-40 z-10 mx-auto w-full max-w-4xl py-16">
    <!-- Même squelette que TowerQuestionCard/TowerResultCard, sans rubans ni
         médaillon : cet écran ne porte ni les chiffres de la partie (déjà lus
         sur le verdict qui précède) ni de verdict à afficher. Juste le coffre.
         Voir components/TowerQuestionCard.vue pour le détail des choix (cqw,
         container-type, sortie du système Base*). -->
    <div
      class="relative mx-auto w-full bg-[url(/images/game-card.webp)] bg-contain bg-center bg-no-repeat"
      style="aspect-ratio: 1980 / 775; container-type: inline-size;"
    >
      <div class="absolute left-1/2 top-1/2 flex h-[70%] w-[56%] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center gap-[1.2cqw] overflow-y-auto text-center">
        <p
          v-if="!chest.opened"
          class="text-[2.2cqw] leading-relaxed text-amber-800"
        >
          Ce coffre rutilant doit renfermer quelque chose de précieux...
        </p>

        <!-- Mêmes deux messages que components/ChestResult.vue, réécrits ici :
             ChestResult repose sur BaseHint (thème sombre), incompatible avec
             le reskin parchemin de cet écran. Voir specs/bonus.md#coffre-et-mimic. -->
        <template v-else>
          <p
            v-if="chest.mimic"
            class="text-[1.6cqw] font-semibold text-rose-700"
          >
            Un mimic. Aucun objet, et toutes tes vies d'un coup.
          </p>
          <p
            v-else-if="chest.spell"
            class="text-[1.6cqw] font-semibold text-emerald-700"
          >
            Le coffre contenait <strong>{{ spellLabel(chest.spell) }}</strong>. Il rejoint ton inventaire.
          </p>
        </template>
      </div>

      <TowerCardButton
        v-if="!chest.opened"
        label="OUVRIR"
        :disabled="opening"
        size="sm"
        @click="$emit('open')"
      />
      <TowerCardButton
        v-else
        :label="action ?? 'Suivant'"
        :disabled="advancing"
        size="sm"
        @click="$emit('advance')"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
// L'ouverture du coffre, à part du verdict qui l'a annoncée : cliquer
// « Suivant » sur TowerResultCard mène ici, « OUVRIR » déclenche le tirage
// serveur, et une fois révélé, ce même bouton fait avancer la partie.
// Voir specs/bonus.md#coffre-et-mimic.
import type { ChestView } from '~~/server/utils/game'

defineProps<{
  chest: ChestView
  /** L'action suivante une fois le coffre ouvert — null tant qu'il ne l'est pas. */
  action: string | null
  opening: boolean
  advancing: boolean
}>()

defineEmits<{ open: [], advance: [] }>()
</script>
