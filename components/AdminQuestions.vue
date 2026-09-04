<script setup lang="ts">
import { floorOptions } from '~~/shared/utils/floors'
import type { QuestionDraft, QuestionEdit } from '~~/server/utils/questions'

// L'écran de gestion du deck. La garde serveur est ce qui protège les données ;
// cet écran n'existe que pour les rendre éditables. Voir specs/admin.md.
const { questions, floor, failed, loading, saving, create, edit, remove } = await useAdminQuestions()

/** La question en cours d'édition, et celle dont la suppression attend un oui. */
const editing = ref<string | null>(null)
const confirming = ref<string | null>(null)
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

const emptyMessage = computed(() => {
  if (questions.value.length || failed.value) {
    return null
  }

  return floor.value === null
    ? 'Aucune question dans le deck.'
    : `Aucune question à l'étage ${floor.value}.`
})

async function onCreate(draft: QuestionDraft): Promise<void> {
  const created = await create(draft)

  writeFailed.value = !created
  if (created) {
    formKey.value += 1
  }
}

async function onSave(id: string, content: QuestionEdit): Promise<void> {
  const saved = await edit(id, content)

  writeFailed.value = !saved
  if (saved) {
    editing.value = null
  }
}

async function onRemove(id: string): Promise<void> {
  const removed = await remove(id)

  writeFailed.value = !removed
  confirming.value = null
}
</script>

<template>
  <BaseSection title="Questions">
    <template #lead>
      Le contenu du deck. La répartition en étages, elle, appartient au script d'import.
    </template>

    <div class="mt-4 max-w-xs">
      <BaseSelect v-model="selected" label="Filtrer" :options="filterOptions" />
    </div>

    <div class="mt-6 rounded-xl border border-slate-800 p-4">
      <BaseHint class="mb-4">
        Nouvelle question
      </BaseHint>
      <AdminQuestionForm
        :key="formKey"
        submit-label="Créer"
        :pending="saving"
        @create="onCreate"
      />
    </div>

    <BaseNotice v-if="writeFailed">
      L'enregistrement a échoué. Réessaie.
    </BaseNotice>
    <BaseNotice v-if="failed">
      Impossible de lire les questions. Recharge la page.
    </BaseNotice>

    <BaseLoading v-if="loading" class="mt-6">
      Mise à jour du deck…
    </BaseLoading>

    <BaseList :empty="emptyMessage" class="mt-6">
      <li v-for="question in questions" :key="question.id" class="px-4 py-3 text-sm">
        <AdminQuestionForm
          v-if="editing === question.id"
          :question="question"
          submit-label="Enregistrer"
          :pending="saving"
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
              <BaseButton :loading="saving" @click="onRemove(question.id)">
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
  </BaseSection>
</template>
