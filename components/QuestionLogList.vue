<template>
  <!-- La liste à gauche, la question choisie à droite. Sur un écran étroit, la
       question choisie passe au-dessus de la liste, qui défile en dessous. -->
  <div class="flex min-h-0 flex-col gap-6 md:flex-row">
    <section class="flex min-h-0 flex-1 flex-col">
      <slot name="tabs" />

      <p v-if="failed" class="mt-4 text-sm italic text-rose-900/80">
        Impossible de lire le Volumen. Recharge la page.
      </p>

      <!-- La première page en route : la silhouette des lignes à venir. Une page
           tournée, elle, garde la précédente à l'écran, pâlie le temps de la
           lecture. -->
      <ul v-else-if="!loaded" class="mt-4 flex flex-col gap-2 pr-2" aria-busy="true">
        <li v-for="width in SKELETON_WIDTHS" :key="width" class="rounded-lg border border-amber-900/25 px-4 py-3">
          <BaseSkeleton parchment :width="width" />
        </li>
      </ul>

      <template v-else>
        <ul
          class="mt-4 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-2 transition-opacity"
          :class="loading ? 'opacity-50' : ''"
          :aria-busy="loading"
        >
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
      <!-- Toute la hauteur du panneau : titre en haut, seuil du pool en bas.
           Une question trop longue fait défiler le panneau, haut lisible. -->
      <QuestionLogDetail
        v-if="selected"
        :key="selected.questionId"
        class="flex-1"
        :entry="selected"
        :pool-successes-to-leave="poolSuccessesToLeave"
      />
      <p v-else-if="entries.length" class="my-auto text-center text-sm italic text-amber-900/60">
        Aucune question sélectionnée
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
  correct: 'Aucune question connue pour l\'instant.',
  all: 'Aucune question vue pour l\'instant.',
}

// Des longueurs différentes, comme de vrais énoncés.
const SKELETON_WIDTHS = ['w-3/4', 'w-1/2', 'w-2/3', 'w-5/6', 'w-3/5']

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
