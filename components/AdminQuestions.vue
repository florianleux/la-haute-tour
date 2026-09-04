<script setup lang="ts">
import { floorOptions } from '~~/shared/utils/floors'
import type { QuestionDraft, QuestionEdit } from '~~/server/utils/questions'

// L'écran de gestion du deck. La garde serveur est ce qui protège les données ;
// cet écran n'existe que pour les rendre éditables. Voir specs/admin.md.
const {
  questions,
  floor,
  search,
  total,
  page,
  limit,
  failed,
  loading,
  create,
  edit,
  remove,
} = await useAdminQuestions()

/** La question en cours d'édition, et celle dont la suppression attend un oui. */
const editing = ref<string | null>(null)
const confirming = ref<string | null>(null)
/**
 * Le formulaire ou le bouton exact sur lequel on vient de cliquer : lui seul
 * montre son loader. Le `saving` du composable, lui, est vrai pour tout le deck :
 * il ferait tourner la création pendant qu'on supprime une question plus bas.
 */
const submitting = ref<'create' | string | null>(null)
const removing = ref<string | null>(null)
const writeFailed = ref(false)
// Remet le formulaire de création à blanc : il tient ses champs, pas le parent.
const formKey = ref(0)

/** Le filtre, tel qu'un `<select>` le porte : une chaîne, vide pour « tous ». */
const NO_FILTER = ''
const selected = ref(NO_FILTER)

const filterOptions = [{ value: NO_FILTER, label: 'Tous les étages' }, ...floorOptions()]

// La conversion vit ici, avec le widget : le composable, lui, parle en étages.
watch(selected, (value) => {
  floor.value = value === NO_FILTER ? null : Number(value)
})

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / limit)))
const canPrev = computed(() => page.value > 1)
const canNext = computed(() => page.value < totalPages.value)

function goToPrev(): void {
  if (canPrev.value) {
    page.value -= 1
  }
}

function goToNext(): void {
  if (canNext.value) {
    page.value += 1
  }
}

// La première lecture n'a encore aucune question à montrer : on montre leur
// forme. Une relecture garde la liste — le bouton cliqué porte déjà son loader.
const firstLoad = computed(() => loading.value && questions.value.length === 0)
const SKELETONS = 5

const emptyMessage = computed(() => {
  if (questions.value.length || failed.value || firstLoad.value) {
    return null
  }

  if (search.value) {
    return `Aucune question ne contient « ${search.value} ».`
  }

  return floor.value === null
    ? 'Aucune question dans le deck.'
    : `Aucune question à l'étage ${floor.value}.`
})

async function onCreate(draft: QuestionDraft): Promise<void> {
  submitting.value = 'create'
  const created = await create(draft)
  submitting.value = null

  writeFailed.value = !created
  if (created) {
    formKey.value += 1
  }
}

async function onSave(id: string, content: QuestionEdit): Promise<void> {
  submitting.value = id
  const saved = await edit(id, content)
  submitting.value = null

  writeFailed.value = !saved
  if (saved) {
    editing.value = null
  }
}

async function onRemove(id: string): Promise<void> {
  removing.value = id
  const removed = await remove(id)
  removing.value = null

  writeFailed.value = !removed
  confirming.value = null
}
</script>

<template>
  <BaseSection title="Questions">
    <template #lead>
      Le contenu du deck. La répartition en étages, elle, appartient au script d'import.
    </template>

    <div class="mt-4 flex flex-wrap items-end gap-3">
      <div class="max-w-xs flex-1">
        <BaseSelect v-model="selected" label="Filtrer" :options="filterOptions" />
      </div>
      <div class="flex-1">
        <BaseInput v-model="search" label="Recherche" placeholder="Capitale de la Gironde ?" />
      </div>
    </div>

    <div class="mt-6 rounded-xl border border-slate-800 p-4">
      <BaseHint class="mb-4">
        Nouvelle question
      </BaseHint>
      <AdminQuestionForm
        :key="formKey"
        submit-label="Créer"
        :pending="submitting === 'create'"
        @create="onCreate"
      />
    </div>

    <BaseNotice v-if="writeFailed">
      L'enregistrement a échoué. Réessaie.
    </BaseNotice>
    <BaseNotice v-if="failed">
      Impossible de lire les questions. Recharge la page.
    </BaseNotice>

    <BaseList :empty="emptyMessage" class="mt-6">
      <li
        v-for="index in (firstLoad ? SKELETONS : 0)"
        :key="`skeleton-${index}`"
        class="space-y-2 px-4 py-3"
      >
        <BaseSkeleton height="h-4" width="w-3/4" />
        <BaseSkeleton height="h-3" width="w-1/2" />
        <BaseSkeleton height="h-3" width="w-2/5" />
      </li>

      <li v-for="question in questions" :key="question.id" class="px-4 py-3 text-sm">
        <AdminQuestionForm
          v-if="editing === question.id"
          :question="question"
          submit-label="Enregistrer"
          :pending="submitting === question.id"
          @save="content => onSave(question.id, content)"
          @cancel="editing = null"
        />

        <div v-else class="flex items-start justify-between gap-4">
          <div>
            <p class="font-medium text-slate-100">
              {{ question.statement }}
            </p>
            <BaseHint class="mt-1">
              Étage {{ question.floor }} — réponse affichée :
              <AnswerLabel :label="question.answerLabel" />
            </BaseHint>
            <BaseHint class="mt-1">
              Acceptées : {{ question.acceptedAnswers.join(' · ') || 'aucune' }}
            </BaseHint>
          </div>

          <div class="flex shrink-0 gap-2">
            <template v-if="confirming === question.id">
              <BaseButton :loading="removing === question.id" @click="onRemove(question.id)">
                Confirmer
              </BaseButton>
              <BaseButton variant="ghost" @click="confirming = null">
                Annuler
              </BaseButton>
            </template>
            <template v-else>
              <BaseButton variant="ghost" @click="editing = question.id">
                Éditer
              </BaseButton>
              <BaseButton variant="ghost" @click="confirming = question.id">
                Supprimer
              </BaseButton>
            </template>
          </div>
        </div>
      </li>
    </BaseList>

    <div class="mt-4 flex items-center justify-between text-sm">
      <BaseButton variant="ghost" :disabled="!canPrev" @click="goToPrev">
        Précédent
      </BaseButton>
      <BaseHint>
        Page {{ page }} sur {{ totalPages }}
      </BaseHint>
      <BaseButton variant="ghost" :disabled="!canNext" @click="goToNext">
        Suivant
      </BaseButton>
    </div>
  </BaseSection>
</template>
