<script setup lang="ts">
// L'inventaire, consultable pendant l'attente et là seulement. Le lancer et le
// journal viennent après ; cette page ne fait que montrer ce qu'on possède.
// Voir specs/ecrans.md#sorts.
definePageMeta({
  // Hors attente, la page n'est pas atteignable — URL comprise. Le serveur
  // refuse déjà la lecture ; la garde épargne au joueur un écran qu'il ne
  // pourrait pas remplir. Voir middleware/cooldown.ts.
  middleware: 'cooldown',
})

const { entries, total, failed } = await useInventory()
</script>

<template>
  <BaseCard wide title="Tes sorts">
    <template #lead>
      Ce que tes coffres t'ont donné. Les lancer viendra ; pour l'instant, tu
      comptes.
    </template>

    <BaseNotice v-if="failed">
      Impossible de lire ton inventaire. Recharge la page.
    </BaseNotice>

    <BaseSection v-else :title="`Inventaire (${total})`" class="mt-8">
      <BaseList
        class="mt-4"
        :empty="entries.length ? null : 'Aucun sort pour l\'instant : les coffres des questions loot en donnent.'"
      >
        <li
          v-for="entry in entries"
          :key="entry.spell"
          class="flex items-baseline justify-between gap-4 px-4 py-3"
        >
          <span class="font-medium">{{ spellLabel(entry.spell) }}</span>
          <!-- Les doublons se comptent plutôt qu'ils ne s'alignent : un
               exemplaire ne se distingue d'un autre par rien. -->
          <span class="text-sm text-slate-400">×{{ entry.count }}</span>
        </li>
      </BaseList>
    </BaseSection>
  </BaseCard>
</template>
