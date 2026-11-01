<template>
  <div>
    <h1 class="text-2xl font-bold">
      Administration
    </h1>

    <BaseTabs v-model="tab" :tabs="tabs" class="mt-6" />

    <div class="mt-8">
      <AdminDisputes v-if="tab === 'disputes'" />
      <AdminQuestions v-else-if="tab === 'questions'" />
      <AdminTestPlayers v-else-if="tab === 'testPlayers'" />
      <AdminPlayers v-else-if="tab === 'players'" />
      <AdminFocusLosses v-else-if="tab === 'cheat'" />
      <AdminMaintenance v-else-if="tab === 'maintenance'" />
    </div>
  </div>
</template>

<script setup lang="ts">
// The server guard (requireAdmin) is what protects the data; this flag only
// spares the player a screen the API would refuse to fill. See specs/admin.md.
definePageMeta({ admin: true, layout: 'admin' })

type AdminTab = 'disputes' | 'questions' | 'players' | 'testPlayers' | 'cheat' | 'maintenance'

const tabs: { id: AdminTab, label: string }[] = [
  { id: 'disputes', label: 'Contestations' },
  { id: 'questions', label: 'Questions' },
  { id: 'players', label: 'Joueurs' },
  { id: 'testPlayers', label: 'Test' },
  { id: 'cheat', label: 'Triche' },
  { id: 'maintenance', label: 'Maintenance' },
]

const tab = ref<AdminTab>('disputes')
</script>
