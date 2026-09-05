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

<template>
  <div>
    <h1 class="text-2xl font-bold">
      Administration
    </h1>

    <div class="mt-6 flex gap-2 border-b border-slate-800">
      <button
        v-for="item in tabs"
        :key="item.id"
        type="button"
        class="-mb-px cursor-pointer border-b-2 px-4 py-2 text-sm font-medium transition-colors"
        :class="tab === item.id
          ? 'border-indigo-400 text-slate-100'
          : 'border-transparent text-slate-400 hover:text-slate-100'"
        @click="tab = item.id"
      >
        {{ item.label }}
      </button>
    </div>

    <div class="mt-8">
      <AdminDisputes v-if="tab === 'disputes'" />
      <AdminQuestions v-else-if="tab === 'questions'" />
      <AdminTestPlayers v-else-if="tab === 'testPlayers'" />
      <div v-else-if="tab === 'players'" class="space-y-12">
        <AdminPlayers />
        <AdminWhitelist />
      </div>
      <AdminFocusLosses v-else-if="tab === 'cheat'" />
      <AdminMaintenance v-else-if="tab === 'maintenance'" />
    </div>
  </div>
</template>
