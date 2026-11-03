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
    <div class="flex gap-3">
      <BaseButton :disabled="!complete" :loading="pending" @click="submit">
        {{ submitLabel }}
      </BaseButton>
      <BaseButton variant="ghost" @click="emit('cancel')">
        Annuler
      </BaseButton>
    </div>
  </form>
</template>

<script setup lang="ts">
import type { AdminQuestion, QuestionEdit } from '~~/server/utils/questions'

const props = withDefaults(defineProps<{
  /** La question éditée. */
  question: AdminQuestion
  submitLabel: string
  pending?: boolean
}>(), {
  pending: false,
})

// L'étage ne s'édite pas : la répartition du deck appartient au script
// d'import. Voir specs/admin.md.
const emit = defineEmits<{
  save: [QuestionEdit]
  cancel: []
}>()

const statement = ref(props.question.statement)
const answerLabel = ref(props.question.answerLabel)
// Une réponse acceptée par ligne : elles contiennent des espaces et des
// parenthèses, un séparateur en ligne finirait par en couper une en deux.
const accepted = ref(props.question.acceptedAnswers.join('\n'))

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

  emit('save', {
    statement: statement.value.trim(),
    answerLabel: answerLabel.value.trim(),
    acceptedAnswers: acceptedAnswers.value,
  })
}
</script>
