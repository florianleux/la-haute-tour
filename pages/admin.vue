<template>
  <div>
    <h1 class="text-2xl font-bold">
      Administration
    </h1>

    <!-- Les onglets défilent sur un écran étroit au lieu d'élargir la page.
         `pb-px` laisse la place au liseré de l'onglet choisi, qui déborde
         d'un pixel sous la barre. -->
    <div class="mt-6 overflow-x-auto pb-px [scrollbar-width:none]">
      <BaseTabs v-model="tab" :tabs="tabs" class="w-max min-w-full" />
    </div>

    <!-- Chaque onglet attend sa lecture avant de s'afficher : timeout 0 montre
         le chargement tout de suite, plutôt que l'onglet d'avant qui reste figé. -->
    <div class="mt-8">
      <Suspense :timeout="0">
        <AdminPlayers v-if="tab === 'players'" />
        <AdminDisputes v-else-if="tab === 'disputes'" />
        <AdminQuestions v-else-if="tab === 'questions'" />
        <AdminTestPlayers v-else-if="tab === 'testPlayers'" />
        <AdminMaintenance v-else-if="tab === 'maintenance'" />
        <template #fallback>
          <BaseLoading>Chargement…</BaseLoading>
        </template>
      </Suspense>
    </div>
  </div>
</template>

<script setup lang="ts">
// The server guard (requireAdmin) is what protects the data; this flag only
// spares the player a screen the API would refuse to fill. See specs/admin.md.
definePageMeta({ admin: true, layout: 'admin' })

type AdminTab = 'disputes' | 'questions' | 'players' | 'testPlayers' | 'maintenance'

// La file partage sa clé avec l'onglet : un verdict rendu là-bas met le badge à jour.
const { disputes } = await useAdminDisputes()

const tabs = computed<{ id: AdminTab, label: string, badge?: number }[]>(() => [
  { id: 'players', label: 'Joueurs' },
  { id: 'disputes', label: 'Contestations', badge: disputes.value.length },
  { id: 'questions', label: 'Questions' },
  { id: 'testPlayers', label: 'Test' },
  { id: 'maintenance', label: 'Maintenance' },
])

const tab = ref<AdminTab>('players')
</script>
