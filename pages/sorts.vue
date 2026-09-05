<template>
  <BaseCard wide title="Tes sorts">
    <template #lead>
      Ce que tes coffres t'ont donné. Un sort se lance sur toi, une seule fois
      par attente, et s'appliquera à ta prochaine tentative.
    </template>

    <BaseNotice v-if="failed">
      Impossible de lire ton inventaire. Recharge la page.
    </BaseNotice>

    <template v-else>
      <BaseSection :title="`Inventaire (${total})`" class="mt-8">
        <BaseList
          class="mt-4"
          :empty="entries.length ? null : 'Aucun sort pour l\'instant : les coffres des questions loot en donnent.'"
        >
          <li
            v-for="entry in entries"
            :key="entry.spell"
            class="flex items-center justify-between gap-4 px-4 py-3"
          >
            <span class="font-medium">
              {{ spellLabel(entry.spell) }}
              <!-- Les doublons se comptent plutôt qu'ils ne s'alignent : un
                   exemplaire ne se distingue d'un autre par rien. -->
              <span class="ml-1 text-sm font-normal text-slate-400">×{{ entry.count }}</span>
            </span>
            <!-- Un sort dont l'effet n'existe pas encore attend son tour dans
                 l'inventaire : le lancer coûterait un exemplaire pour rien. -->
            <BaseHint v-if="!isCastable(entry.spell)">
              Bientôt lançable
            </BaseHint>
            <BaseButton
              v-else
              variant="ghost"
              :loading="casting === entry.spell"
              @click="castOnSelf(entry.spell)"
            >
              Lancer sur moi
            </BaseButton>
          </li>
        </BaseList>
      </BaseSection>

      <BaseNotice v-if="castFailed" class="mt-4">
        Le sort n'est pas parti. Réessaie.
      </BaseNotice>

      <!-- Le journal : c'est là que le lanceur lit ce qu'il a envoyé, et quand.
           Il survit à l'effet, qui meurt avec la tentative qu'il a ouverte. -->
      <BaseSection title="Ce que tu as lancé" class="mt-8">
        <BaseList class="mt-4" :empty="log.length ? null : 'Tu n\'as encore rien lancé.'">
          <li
            v-for="entry in log"
            :key="entry.castAt"
            class="flex items-baseline justify-between gap-4 px-4 py-3"
          >
            <span class="font-medium">{{ spellLabel(entry.spell) }} — sur {{ entry.targetName }}</span>
            <span class="text-sm text-slate-400">{{ formatDayTime(entry.castAt) }}</span>
          </li>
        </BaseList>
      </BaseSection>
    </template>
  </BaseCard>
</template>

<script setup lang="ts">
// L'inventaire, le lancer et le journal — pendant l'attente et là seulement.
// Le lancer ne vise que soi à ce stade : les catégories Allié et Ennemi arrivent
// avec les équipes. Voir specs/ecrans.md#sorts.
import { isCastable } from '~~/shared/utils/spells'
import type { SpellId } from '~~/shared/utils/spells'

definePageMeta({
  // Hors attente, la page n'est pas atteignable — URL comprise. Le serveur
  // refuse déjà la lecture ; la garde épargne au joueur un écran qu'il ne
  // pourrait pas remplir. Voir middleware/cooldown.ts.
  middleware: 'cooldown',
})

const { entries, total, log, failed, casting, castFailed, cast } = await useInventory()

// Le récapitulatif de ce qui attend la prochaine tentative vit sur l'écran de
// jeu : un sort lancé d'ici doit s'y voir au retour, pas au rechargement
// suivant.
const { refresh: refreshGame } = await useGameState()

async function castOnSelf(spell: SpellId): Promise<void> {
  await cast(spell)
  await refreshGame()
}
</script>
