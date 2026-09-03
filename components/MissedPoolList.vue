<script setup lang="ts">
// Fiche de révision, pas punition : les réponses sont montrées, et c'est ce qui
// rend le seuil de sortie du pool atteignable. Voir specs/mecanique.md.
const { entries, total, order, loading, hasMore, loaded, failed, loadMore, toggleOrder } = useMissedPool()

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
  <section>
    <div class="flex items-baseline justify-between">
      <h2 class="text-lg font-semibold">
        Tes erreurs de l'étage ({{ total }})
      </h2>
      <BaseButton variant="ghost" @click="toggleOrder">
        {{ order === 'desc' ? 'Plus récentes d\'abord' : 'Plus anciennes d\'abord' }}
      </BaseButton>
    </div>

    <BaseNotice v-if="failed">
      Impossible de charger tes erreurs. Recharge la page.
    </BaseNotice>

    <ul class="mt-4 divide-y divide-slate-800 rounded-xl border border-slate-800">
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
      <li v-if="loaded && !entries.length && !failed" class="px-4 py-3 text-sm text-slate-500">
        Aucune erreur à réviser sur cet étage.
      </li>
    </ul>

    <!-- Sentinelle de défilement : la page suivante se charge en arrivant dessus. -->
    <div ref="sentinel" class="h-4" />
    <p v-if="loading" class="mt-2 text-sm text-slate-500">
      <BaseSpinner>Chargement des erreurs…</BaseSpinner>
    </p>
  </section>
</template>
