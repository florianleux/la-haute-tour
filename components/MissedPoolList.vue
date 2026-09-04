<script setup lang="ts">
// Fiche de révision, pas punition : les réponses sont montrées, et c'est ce qui
// rend le seuil de sortie du pool atteignable. Voir specs/mecanique.md.
const { entries, total, order, loading, hasMore, loaded, failed, loadMore, toggleOrder } = useMissedPool()

// Rien à dire tant que la première page n'est pas revenue, ni quand la lecture a
// échoué : « aucune erreur » et « je ne sais pas » ne sont pas la même nouvelle.
const emptyMessage = computed(
  () => (loaded.value && !entries.value.length && !failed.value
    ? 'Aucune erreur à réviser sur cet étage.'
    : null),
)

const sentinel = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | undefined

onMounted(async () => {
  await loadMore()

  observer = new IntersectionObserver((records) => {
    if (records.some(record => record.isIntersecting) && hasMore.value) {
      loadMore()
    }
  })

  if (sentinel.value) {
    observer.observe(sentinel.value)
  }
})

onUnmounted(() => observer?.disconnect())
</script>

<template>
  <BaseSection :title="`Tes erreurs de l'étage (${total})`">
    <template #aside>
      <BaseButton variant="ghost" @click="toggleOrder">
        {{ order === 'desc' ? 'Plus récentes d\'abord' : 'Plus anciennes d\'abord' }}
      </BaseButton>
    </template>

    <BaseNotice v-if="failed">
      Impossible de charger tes erreurs. Recharge la page.
    </BaseNotice>

    <BaseList :empty="emptyMessage" class="mt-4">
      <li v-for="entry in entries" :key="entry.questionId" class="px-4 py-3">
        <p class="text-sm">
          {{ entry.statement }}
        </p>
        <p class="mt-1 text-sm font-semibold text-emerald-400">
          {{ entry.answerLabel }}
        </p>
        <p class="mt-1 text-xs text-slate-500">
          Dernier échec le {{ formatDay(entry.lastFailedAt) }}
        </p>
      </li>
    </BaseList>

    <!-- Sentinelle de défilement : la page suivante se charge en arrivant dessus. -->
    <div ref="sentinel" class="h-4" />
    <BaseLoading v-if="loading" class="mt-2">
      Chargement des erreurs…
    </BaseLoading>
  </BaseSection>
</template>
