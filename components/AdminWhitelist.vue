<script setup lang="ts">
// La liste des Discord IDs autorisés. La garde serveur est ce qui protège ;
// cet écran ne fait que lire et ajouter. Voir specs/admin.md.
const { entries, failed, add, adding, loading } = await useWhitelist()

const discordId = ref('')
const addFailed = ref(false)

// Pas de « liste vide » quand la lecture a échoué : ce serait la même phrase
// pour « personne n'est autorisé » et « je ne sais pas ».
const emptyMessage = computed(
  () => (entries.value.length || failed.value ? null : 'Aucun Discord ID autorisé pour l\'instant.'),
)

async function submit(): Promise<void> {
  if (!discordId.value.trim()) {
    return
  }

  const added = await add(discordId.value)

  addFailed.value = !added
  if (added) {
    discordId.value = ''
  }
}
</script>

<template>
  <BaseSection title="Whitelist Discord">
    <template #lead>
      Seuls ces Discord IDs peuvent créer un compte.
    </template>

    <form class="mt-4 flex items-end gap-3" @submit.prevent="submit">
      <BaseInput
        v-model="discordId"
        label="Discord ID"
        placeholder="123456789012345678"
        class="flex-1"
      />
      <BaseButton :disabled="!discordId.trim()" :loading="adding" @click="submit">
        Ajouter
      </BaseButton>
    </form>

    <BaseNotice v-if="addFailed">
      L'ajout a échoué. Réessaie.
    </BaseNotice>
    <BaseNotice v-if="failed">
      Impossible de lire la whitelist. Recharge la page.
    </BaseNotice>

    <BaseLoading v-if="loading" class="mt-6">
      Mise à jour de la liste…
    </BaseLoading>

    <BaseList :empty="emptyMessage" class="mt-6">
      <li
        v-for="entry in entries"
        :key="entry.discordId"
        class="flex items-center justify-between px-4 py-3 text-sm"
      >
        <span class="font-mono">{{ entry.discordId }}</span>
        <span class="text-slate-500">{{ formatDay(entry.createdAt) }}</span>
      </li>
    </BaseList>
  </BaseSection>
</template>
