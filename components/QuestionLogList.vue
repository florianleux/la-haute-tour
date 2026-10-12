<template>
  <div>
    <BaseNotice v-if="failed">
      Impossible de lire le Volumen. Recharge la page.
    </BaseNotice>

    <template v-else>
      <BaseList :empty="emptyMessage">
        <QuestionLogEntry
          v-for="entry in entries"
          :key="entry.questionId"
          :entry="entry"
          :pool-successes-to-leave="poolSuccessesToLeave"
        />
      </BaseList>

      <BasePagination
        :model-value="page"
        :page-count="pageCount"
        :disabled="loading"
        class="mt-6"
        @update:model-value="load"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
// Un onglet du Volumen, vingt questions par page. Voir specs/ecrans.md#volumen.
import type { QuestionLogTab } from '~/composables/useQuestionLog'

const props = defineProps<{ tab: QuestionLogTab }>()

const EMPTY: Record<QuestionLogTab, string> = {
  missed: 'Rien à revoir sur cet étage.',
  correct: 'Aucune question sue pour l\'instant.',
  all: 'Aucune question vue pour l\'instant.',
}

const { entries, page, pageCount, poolSuccessesToLeave, loading, loaded, failed, load } = useQuestionLog(props.tab)

// Rien à dire tant que la première page n'est pas revenue : « aucune question »
// et « je ne sais pas encore » ne sont pas la même nouvelle.
const emptyMessage = computed(() => (loaded.value && !entries.value.length ? EMPTY[props.tab] : null))

onMounted(() => load(1))

// Une contestation qui se termine change ce que le serveur dit de la question,
// dans chaque onglet qui la montre : tous relisent leur page, celui d'où elle
// est partie comme ceux que KeepAlive garde montés. Rien d'autre ne fait relire
// — passer d'un onglet à l'autre ne coûte aucune lecture.
const { disputingId } = useDisputes()
watch(disputingId, (now, before) => {
  if (before && !now) {
    load(page.value)
  }
})
</script>
