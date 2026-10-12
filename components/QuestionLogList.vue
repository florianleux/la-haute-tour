<template>
  <!-- La liste à gauche, la question choisie à droite. Sur un écran étroit, la
       question choisie passe au-dessus de la liste, qui défile en dessous. -->
  <div class="flex min-h-0 flex-col gap-6 md:flex-row">
    <section class="flex min-h-0 flex-1 flex-col">
      <slot name="tabs" />

      <p v-if="failed" class="mt-4 text-sm italic text-rose-900/80">
        Impossible de lire le Volumen. Recharge la page.
      </p>

      <template v-else>
        <ul class="mt-4 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-2">
          <QuestionLogEntry
            v-for="entry in entries"
            :key="entry.questionId"
            :entry="entry"
            :selected="entry.questionId === selectedId"
            @select="selectedId = entry.questionId"
          />
          <li v-if="emptyMessage" class="text-sm italic text-amber-900/60">
            {{ emptyMessage }}
          </li>
        </ul>

        <BasePagination
          :model-value="page"
          :page-count="pageCount"
          :disabled="loading"
          parchment
          class="mt-4"
          @update:model-value="load"
        />
      </template>
    </section>

    <section
      class="@container flex flex-1 flex-col overflow-y-auto max-md:order-first max-md:max-h-[45%] md:border-l md:border-amber-900/20 md:pl-6"
      :class="selected ? '' : 'max-md:hidden'"
    >
      <!-- Centrée en hauteur par `my-auto` plutôt que `justify-center` : une
           question trop longue pour le panneau garde son haut lisible au lieu
           de déborder au-dessus. -->
      <QuestionLogDetail
        v-if="selected"
        :key="selected.questionId"
        class="my-auto"
        :entry="selected"
        :pool-successes-to-leave="poolSuccessesToLeave"
      />
      <p v-else-if="entries.length" class="my-auto text-center text-sm italic text-amber-900/60">
        Choisis une question pour relire sa réponse.
      </p>
    </section>
  </div>
</template>

<script setup lang="ts">
// Un onglet du Volumen, vingt questions par page, et celle qu'on y relit. Voir
// specs/ecrans.md#volumen.
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

// Gardée par son id, relue dans la page : après une contestation, la question
// affichée est celle que le serveur vient de renvoyer. Une page tournée qui ne
// la contient plus la referme.
const selectedId = ref<string | null>(null)
const selected = computed(() => entries.value.find(entry => entry.questionId === selectedId.value) ?? null)

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
