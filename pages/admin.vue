<script setup lang="ts">
// The server guard (requireAdmin) is what protects the data; this flag only
// spares the player a screen the API would refuse to fill. See specs/admin.md.
definePageMeta({ admin: true, layout: 'admin' })

const { entries, failed, add, adding, loading } = await useWhitelist()

const discordId = ref('')
const addFailed = ref(false)

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
  <div>
    <h1 class="text-2xl font-bold">
      Administration
    </h1>

    <section class="mt-8">
      <h2 class="text-lg font-semibold">
        Whitelist Discord
      </h2>
      <p class="mt-1 text-sm text-slate-400">
        Seuls ces Discord IDs peuvent créer un compte.
      </p>

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

      <p v-if="loading" class="mt-6 text-sm text-slate-500">
        <BaseSpinner>Mise à jour de la liste…</BaseSpinner>
      </p>

      <ul class="mt-6 divide-y divide-slate-800 rounded-xl border border-slate-800">
        <li
          v-for="entry in entries"
          :key="entry.discordId"
          class="flex items-center justify-between px-4 py-3 text-sm"
        >
          <span class="font-mono">{{ entry.discordId }}</span>
          <span class="text-slate-500">{{ formatDay(entry.createdAt) }}</span>
        </li>
        <!-- Pas de « liste vide » quand la lecture a échoué : ce serait la même
             phrase pour « personne n'est autorisé » et « je ne sais pas ». -->
        <li v-if="!entries.length && !failed" class="px-4 py-3 text-sm text-slate-500">
          Aucun Discord ID autorisé pour l'instant.
        </li>
      </ul>
    </section>

    <BaseButton to="/" variant="ghost" class="mt-8">
      Retour à l'accueil
    </BaseButton>
  </div>
</template>
