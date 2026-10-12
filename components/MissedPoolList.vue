<template>
  <BaseSection :title="`Tes erreurs de l'étage (${total})`">

    <BaseNotice v-if="failed">
      Impossible de charger tes erreurs. Recharge la page.
    </BaseNotice>

    <BaseList
      :empty="emptyMessage"
      class="mt-4"
    >
      <li
        v-for="entry in entries"
        :key="entry.questionId"
        class="flex items-start justify-between gap-4 px-4 py-3"
      >
        <div class="min-w-0 flex-1">
          <p class="text-sm">
            {{ entry.statement }}
          </p>
          <p class="mt-1 text-sm font-bold text-emerald-400">
            {{ entry.answerLabel }}
          </p>
          <BaseHint class="mt-1">
            Ta réponse : {{ entry.submittedAnswer || '—' }}
          </BaseHint>
          <p class="mt-1 text-xs text-slate-500">
            Dernier échec le {{ formatDay(entry.lastFailedAt) }}
          </p>
        </div>

        <div class="flex shrink-0 items-center gap-2">
          <!-- Contestation en cours : spinner + texte -->
          <template v-if="disputingId === entry.questionId || entry.disputeStatus === 'pending'">
            <BaseSpinner />
            <span class="text-xs text-slate-400">Contestation en cours…</span>
          </template>

          <!-- Contestation refusée : texte seul -->
          <span
            v-else-if="entry.disputeStatus === 'rejected'"
            class="text-xs text-amber-400"
          >
            Contestation refusée
          </span>

          <!-- Bouton contester : icône mégaphone ronde -->
          <BaseIconButton
            v-else-if="isDisputable(entry.questionId)"
            label="Contester cette question"
            @click="onDispute(entry.questionId)"
          >
            <path
              d="M3 10v4a1 1 0 0 0 1 1h2l4 4V5L6 9H4a1 1 0 0 0-1 1Zm10.5-4.5a1 1 0 0 0-1.4 0l-.6.6a1 1 0 0 0 0 1.4 5 5 0 0 1 0 7l.6.6a1 1 0 0 0 1.4 0l.6-.6a1 1 0 0 0 0-1.4 3 3 0 0 1 0-4.2l-.6-.6a1 1 0 0 0 0-1.4Z"
            />
          </BaseIconButton>
        </div>
      </li>
    </BaseList>

    <!-- Sentinelle de défilement : la page suivante se charge en arrivant dessus. -->
    <div
      ref="sentinel"
      class="h-4"
    />
    <BaseLoading
      v-if="loading"
      class="mt-2"
    >
      Chargement des erreurs…
    </BaseLoading>
  </BaseSection>
</template>

<script setup lang="ts">
// Fiche de révision, pas punition : les réponses sont montrées, et c'est ce qui
// rend le seuil de sortie du pool atteignable. La contestation fusionne ici :
// chaque carte porte son statut à droite. Voir specs/mecanique.md.
// Le tri par date n'est plus proposé à l'écran depuis le passage au mobile. Le
// composable l'expose toujours — `order` et `toggleOrder` attendent qu'un bouton
// les rappelle — mais les lire ici sans s'en servir ne fait que mentir.
const { entries, total, loading, hasMore, loaded, failed, loadMore } = useMissedPool()
const { isDisputable, sendDispute, disputingId } = useDisputes()

// Rien à dire tant que la première page n'est pas revenue, ni quand la lecture
// a échoué : « aucune erreur » et « je ne sais pas » ne sont pas la même nouvelle.
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

// Quand une contestation part du verdict (pas d'ici), disputingId passe d'un
// id à null. Si la question n'est plus contestable, c'est que le POST a réussi :
// on met à jour l'entrée du pool localement. Voir Q16/D.
watch(disputingId, (newId, oldId) => {
  if (oldId && !newId) {
    const entry = entries.value.find(e => e.questionId === oldId)
    if (entry && !isDisputable(oldId)) {
      entry.disputeStatus = 'pending'
    }
  }
})

async function onDispute(questionId: string): Promise<void> {
  const entry = entries.value.find(e => e.questionId === questionId)
  if (entry) {
    entry.disputeStatus = 'pending'
  }
  const success = await sendDispute(questionId)
  if (!success && entry) {
    entry.disputeStatus = 'none'
  }
}
</script>
