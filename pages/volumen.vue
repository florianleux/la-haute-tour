<template>
  <BaseCard wide title="Volumen">
    <template #lead>
      Les questions que tu as croisées dans la Tour, avec leurs réponses. Relis
      celles qui t'ont échappé : le rattrapage les tire dans ce que tu as à revoir.
    </template>

    <BaseTabs v-model="tab" :tabs="tabs" class="mt-6" />

    <!-- Chaque onglet garde sa page quand on passe à un autre et qu'on revient. -->
    <KeepAlive>
      <QuestionLogList :key="tab" :tab="tab" class="mt-6" />
    </KeepAlive>
  </BaseCard>
</template>

<script setup lang="ts">
// Le journal des questions vues, au camp et là seulement : le rattrapage tire
// dans le Pool Échecs, en lire les réponses pendant qu'il tourne serait tricher.
// Voir specs/ecrans.md#volumen.
import type { QuestionLogTab } from '~/composables/useQuestionLog'

definePageMeta({
  // Hors du camp, la page n'est pas atteignable — URL comprise. Le serveur
  // refuse déjà la lecture. Voir middleware/camp.ts.
  middleware: 'camp',
})

const tabs: { id: QuestionLogTab, label: string }[] = [
  { id: 'missed', label: 'À revoir' },
  { id: 'correct', label: 'Sues' },
  { id: 'all', label: 'Toutes' },
]

const tab = ref<QuestionLogTab>('missed')

// Le bouton de contestation ne s'affiche que sur ce que le serveur dit
// contestable : la liste se lit en arrivant.
const { refresh } = useDisputes()
onMounted(refresh)
</script>
