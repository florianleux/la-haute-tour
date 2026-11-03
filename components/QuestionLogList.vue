<template>
  <!-- La liste à gauche, la question choisie à droite. Sur un écran étroit, la
       question choisie passe au-dessus de la liste, qui défile en dessous. -->
  <div class="flex min-h-0 flex-col gap-6 md:flex-row">
    <section class="flex min-h-0 flex-1 flex-col">
      <slot name="tabs" />

      <!-- Rien ne part à la frappe ni au choix : la loupe (ou Entrée) lance. Même
           marge que la liste (pr-2) et même gouttière de scrollbar, invisible :
           les filtres finissent où finissent les lignes. -->
      <div
v-if="hasQuill" class="mt-4 grid grid-cols-[1fr_1fr_auto] items-end gap-3 overflow-y-scroll pr-2 [scrollbar-color:transparent_transparent]"
        :class="lesson?.spotlight === 'search' && 'motion-safe:animate-nudge'"
        @keydown.enter.prevent="apply"
      >
        <BaseInput v-model="draftSearch" label="Recherche" placeholder="Énoncé ou réponse" :maxlength="100" parchment />
        <BaseSelect v-model="draftCategory" label="Catégorie" :options="CATEGORY_OPTIONS" parchment />
        <BaseButton variant="parchment" class="!border-0 !px-3 !py-[13px]" aria-label="Rechercher" :disabled="loading" @click="apply">
          <svg viewBox="0 0 24 24" class="size-5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true">
            <circle cx="10.5" cy="10.5" r="6.5" />
            <path d="m15.5 15.5 5 5" />
          </svg>
        </BaseButton>
      </div>

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
      :class="[selected ? '' : 'max-md:hidden', lesson?.spotlight === 'copy' && 'motion-safe:animate-nudge']"
    >
      <!-- Toute la hauteur du panneau : titre en haut, seuil du pool en bas.
           Une question trop longue fait défiler le panneau, haut lisible. -->
      <QuestionLogDetail
        v-if="selected"
        :key="selected.questionId"
        class="flex-1"
        :entry="selected"
        :pool-successes-to-leave="poolSuccessesToLeave"
        :copyable="hasQuill"
        @copied="unlockCopyAchievement"
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
import type { GameState } from '~~/server/utils/game'
import type { LessonLine } from '~~/utils/lessons'
import type { AchievementId } from '~~/shared/utils/achievements'
import { CATEGORY_LABELS } from '~~/shared/utils/categories'
import type { QuestionLogTab } from '~/composables/useQuestionLog'

const props = defineProps<{
  tab: QuestionLogTab
  /** La réplique de Michel à la leçon de la Plume : il montre la recherche, puis la copie. */
  lesson?: LessonLine
}>()

const EMPTY: Record<QuestionLogTab, string> = {
  missed: 'Rien à revoir sur cet étage.',
  correct: 'Aucune question connue pour l\'instant.',
  all: 'Aucune question vue pour l\'instant.',
}

// Des longueurs différentes, comme de vrais énoncés.
const SKELETON_WIDTHS = ['w-3/4', 'w-1/2', 'w-2/3', 'w-5/6', 'w-3/5']

const { entries, page, pageCount, poolSuccessesToLeave, loading, loaded, failed, search, category, load } = useQuestionLog(props.tab)

const CATEGORY_OPTIONS = [
  { value: '', label: 'Toutes' },
  ...Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label })),
]

// La recherche et la copie sont celles de la Plume de copiste : le camp sait
// déjà si le joueur la porte (l'état de jeu, tenu en cache).
const { data: gameState } = useNuxtData<GameState>(GAME_STATE_KEY)
const hasQuill = computed(() => gameState.value?.hasQuill ?? false)

// Les champs se remplissent sans rien lancer ; la loupe les applique et
// revient à la première page.
const draftSearch = ref('')
const draftCategory = ref('')
function apply(): void {
  search.value = draftSearch.value.trim()
  category.value = draftCategory.value
  void load(1)
}

// « Ça, ça va dans mon Anki ! » : le serveur écarte ce qui est déjà acquis.
const announce = useAchievementAnnouncer()
// Un seul appel par ouverture du Volumen ; un succès qui ne s'écrit pas se
// retentera à la prochaine copie.
let copyAchievementSent = false
async function unlockCopyAchievement(): Promise<void> {
  if (copyAchievementSent) {
    return
  }

  try {
    const { unlocked } = await $fetch<{ unlocked: AchievementId[] }>('/api/profile/copy', {
      method: 'POST',
      ...useApiFetchOptions(),
    })
    copyAchievementSent = true
    announce(unlocked)
  }
  catch {
    // Rien à dire : le succès est sans effet.
  }
}

// Rien à dire tant que la première page n'est pas revenue : « aucune question »
// et « je ne sais pas encore » ne sont pas la même nouvelle.
const emptyMessage = computed(() => {
  if (!loaded.value || entries.value.length) {
    return null
  }
  return search.value || category.value ? 'Aucune question ne correspond.' : EMPTY[props.tab]
})

// Gardée par son id, relue dans la page. Une page tournée qui ne la contient
// plus la referme.
const selectedId = ref<string | null>(null)
const selected = computed(() => entries.value.find(entry => entry.questionId === selectedId.value) ?? null)

onMounted(() => load(1))

// Michel montre la copie sur une question : la première de la liste, ouverte
// pour lui. Le joueur n'a rien à choisir.
watch([() => props.lesson?.spotlight, entries], ([spot]) => {
  if (spot === 'copy' && !selectedId.value && entries.value.length) {
    selectedId.value = entries.value[0].questionId
  }
}, { immediate: true })
</script>
