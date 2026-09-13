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
      <!-- L'équipe se décide en invitant : c'est le seul moment où l'on sait
           pourquoi on invite. Voir specs/equipes.md. -->
      <BaseSelect v-model="team" label="Équipe" :options="teamOptions" />
      <BaseButton :disabled="!discordId.trim()" :loading="adding" @click="submit">
        Ajouter
      </BaseButton>
    </form>

    <BaseNotice v-if="addFailed">
      L'ajout a échoué. Réessaie.
    </BaseNotice>
    <BaseNotice v-if="removeFailed">
      Le retrait a échoué. Réessaie.
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
        <span class="flex items-center gap-3 text-slate-500">
          <span>{{ teamLabel(entry.team) }}</span>
          <span>{{ formatDay(entry.createdAt) }}</span>
          <BaseButton
            variant="ghost"
            :loading="removing === entry.discordId"
            @click="drop(entry.discordId)"
          >
            Retirer
          </BaseButton>
        </span>
      </li>
    </BaseList>
  </BaseSection>
</template>

<script setup lang="ts">
import { TEAM_IDS } from '~~/shared/utils/teams'
import type { TeamId } from '~~/shared/utils/teams'

// La liste des Discord IDs autorisés. La garde serveur est ce qui protège ;
// cet écran ne fait que lire et ajouter. Voir specs/admin.md.
const { entries, failed, add, adding, remove, removing, loading } = await useWhitelist()

const discordId = ref('')

// « Sans équipe » est un choix : l'appartenance reste facultative, et l'admin
// peut inviter sans trancher tout de suite.
const NO_TEAM = 'none'
const team = ref<string>(NO_TEAM)
const teamOptions = [
  { value: NO_TEAM, label: teamLabel(null) },
  ...TEAM_IDS.map(id => ({ value: id, label: teamLabel(id) })),
]
const addFailed = ref(false)
const removeFailed = ref(false)

// Pas de « liste vide » quand la lecture a échoué : ce serait la même phrase
// pour « personne n'est autorisé » et « je ne sais pas ».
const emptyMessage = computed(
  () => (entries.value.length || failed.value ? null : 'Aucun Discord ID autorisé pour l\'instant.'),
)

async function submit(): Promise<void> {
  if (!discordId.value.trim()) {
    return
  }

  const added = await add(discordId.value, team.value === NO_TEAM ? null : (team.value as TeamId))

  addFailed.value = !added
  if (added) {
    discordId.value = ''
  }
}

// Nommé « drop » et non « remove » : `remove` est déjà le geste du composable,
// et les deux dans la même portée se confondraient à la lecture.
async function drop(id: string): Promise<void> {
  removeFailed.value = !await remove(id)
}
</script>
