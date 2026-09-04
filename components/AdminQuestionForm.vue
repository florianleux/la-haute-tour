<script setup lang="ts">
// Importé explicitement : `shared/` est partagé avec le serveur, pas
// auto-importé comme `utils/`.
import { floorOptions } from '~~/shared/utils/floors'
import type { AdminQuestion, QuestionDraft, QuestionEdit } from '~~/server/utils/questions'

const props = withDefaults(defineProps<{
  /** La question éditée, ou rien pour une création. */
  question?: AdminQuestion | null
  submitLabel: string
  pending?: boolean
}>(), {
  question: null,
  pending: false,
})

// Deux sorties plutôt qu'une : l'édition ne porte pas d'étage, et un événement
// qui en promettrait un que le parent doit retirer mentirait sur le contrat.
const emit = defineEmits<{
  create: [QuestionDraft]
  save: [QuestionEdit]
  cancel: []
}>()

const statement = ref(props.question?.statement ?? '')
const answerLabel = ref(props.question?.answerLabel ?? '')
// Une réponse acceptée par ligne : elles contiennent des espaces et des
// parenthèses, un séparateur en ligne finirait par en couper une en deux.
const accepted = ref((props.question?.acceptedAnswers ?? []).join('\n'))
const floor = ref(String(props.question?.floor ?? 1))

const acceptedAnswers = computed(
  () => accepted.value.split('\n').map(answer => answer.trim()).filter(Boolean),
)

// La même frontière que le serveur : sans réponse acceptée, la question serait
// imbattable. Le bouton dit non avant que le serveur ait à le dire.
const complete = computed(() => Boolean(
  statement.value.trim() && answerLabel.value.trim() && acceptedAnswers.value.length,
))

function submit(): void {
  if (!complete.value) {
    return
  }

  const content: QuestionEdit = {
    statement: statement.value.trim(),
    answerLabel: answerLabel.value.trim(),
    acceptedAnswers: acceptedAnswers.value,
  }

  if (props.question) {
    emit('save', content)
    return
  }

  emit('create', { ...content, floor: Number(floor.value) })
}
</script>

<template>
  <form class="space-y-4" @submit.prevent="submit">
    <BaseTextarea
      v-model="statement"
      label="Énoncé"
      placeholder="Qui a découvert la pénicilline ?"
      :rows="2"
    />
    <BaseInput
      v-model="answerLabel"
      label="Réponse affichée"
      placeholder="FLEMING (Alexander)"
    />
    <BaseTextarea
      v-model="accepted"
      label="Réponses acceptées (une par ligne)"
      placeholder="Fleming"
    />
    <!-- L'étage ne se choisit qu'à la création : la répartition du deck
         appartient au script d'import. Voir specs/admin.md. -->
    <BaseSelect
      v-if="!question"
      v-model="floor"
      label="Étage"
      :options="floorOptions()"
    />

    <div class="flex gap-3">
      <BaseButton :disabled="!complete" :loading="pending" @click="submit">
        {{ submitLabel }}
      </BaseButton>
      <BaseButton v-if="question" variant="ghost" @click="emit('cancel')">
        Annuler
      </BaseButton>
    </div>
  </form>
</template>
