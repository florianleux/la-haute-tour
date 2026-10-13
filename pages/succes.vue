<template>
  <BaseCard wide :title="`Haut-faits (${unlockedCount} / ${catalogue.length})`">
    <template #lead>
      Tout ce qu'il y a à accomplir est là, y compris ce que tu n'as pas encore.
      Un succès débloqué l'est à vie, et ne change rien à ta partie.
    </template>

    <BaseNotice v-if="failed" class="mt-6">
      Tes succès n'ont pas pu être lus. Recharge la page.
    </BaseNotice>

    <div v-else class="mt-8 grid grid-cols-4 gap-3 sm:grid-cols-6 lg:grid-cols-8">
      <AchievementTile
        v-for="id in catalogue"
        :id="id"
        :key="id"
        :unlocked-at="unlockedAt.get(id) ?? null"
        @open="opened = id"
      />
    </div>

    <BaseModal v-if="opened" :title="achievementLabel(opened)" @close="opened = null">
      <BaseHint>{{ achievementCondition(opened) }}</BaseHint>
      <BaseHint v-if="unlockedAt.get(opened)" tone="success" class="mt-3">
        Débloqué le {{ formatDay(unlockedAt.get(opened)!) }}.
      </BaseHint>
      <BaseHint v-else class="mt-3">Pas encore débloqué.</BaseHint>
    </BaseModal>
  </BaseCard>
</template>

<script setup lang="ts">
import { ACHIEVEMENT_IDS } from '~~/shared/utils/achievements'
import type { AchievementId } from '~~/shared/utils/achievements'

// Aucune garde de phase : la page se consulte quand on veut, contrairement aux
// Sorts qui n'existent qu'en attente. La barre s'éteint déjà seule pendant une
// question, et middleware/auth.global.ts ferme la page aux non-connectés.
const { unlockedAt, failed } = await useAchievements()

// Le mur suit l'ordre du catalogue : les premières fois d'abord, puis ce qui se
// gagne en montant, et les curiosités à la fin.
const catalogue = ACHIEVEMENT_IDS
const unlockedCount = computed(() => unlockedAt.value.size)

// La tuile ouverte, s'il y en a une. Purement client : rien à persister d'un
// détour par une fiche.
const opened = ref<AchievementId | null>(null)
</script>
