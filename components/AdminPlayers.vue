<template>
  <BaseSection title="Joueurs">
    <template #lead>
      Les Discord IDs invités, où en est chacun, et les gestes qui peuvent le débloquer.
    </template>

    <p class="mt-2 text-sm text-slate-400">
      <span class="mr-4">Actifs aujourd'hui : <span class="font-semibold text-slate-200">{{ active.today }}</span></span>
      <span class="mr-8">Sur 7 jours : <span class="font-semibold text-slate-200">{{ active.week }}</span></span>
      <!-- L'équipe d'arrivée portée par la whitelist, pas celle du compte : ce
           sont les invitations qu'on compte ici. -->
      <span v-for="total in teamTotals" :key="total.label" class="mr-4">
        {{ total.label }} : <span class="font-semibold text-slate-200">{{ total.count }}</span>
      </span>
    </p>

    <form class="mt-4 flex items-end gap-3" @submit.prevent="submit">
      <BaseInput
        v-model="discordId"
        label="Inviter un Discord ID"
        placeholder="123456789012345678"
        class="flex-1"
      />
      <!-- L'équipe se décide en invitant : c'est le seul moment où l'on sait
           pourquoi on invite, et un joueur invité en a toujours une. Voir
           specs/equipes.md. -->
      <BaseSelect v-model="team" label="Équipe" :options="teamOptions" />
      <BaseButton :disabled="!ready" :loading="adding" @click="submit">
        Ajouter
      </BaseButton>
    </form>

    <BaseNotice v-if="addFailed">
      L'ajout a échoué. Réessaie.
    </BaseNotice>
    <BaseNotice v-if="actionFailed">
      L'action a échoué. Réessaie.
    </BaseNotice>
    <BaseNotice v-if="failed">
      Impossible de lire les joueurs. Recharge la page.
    </BaseNotice>

    <BaseLoading v-if="firstLoad" class="mt-6">
      Lecture des joueurs…
    </BaseLoading>
    <BaseEmpty v-else-if="emptyMessage" class="mt-6">
      {{ emptyMessage }}
    </BaseEmpty>

    <table v-if="rows.length" class="mt-6 w-full text-left">
      <thead class="text-xs uppercase tracking-wide text-slate-500">
        <tr>
          <th class="py-2 pr-4 font-medium">
            Joueur
          </th>
          <th class="py-2 pr-4 font-medium">
            Équipe
          </th>
          <th class="py-2 pr-4 font-medium">
            Étage
          </th>
          <th class="py-2 pr-4 font-medium">
            Phase
          </th>
          <th class="py-2 pr-4 font-medium">
            Vies
          </th>
          <th class="py-2 pr-4 font-medium" title="Contestations en attente">
            Cont.
          </th>
          <th class="py-2 pr-4 font-medium">
            Dernier jeu
          </th>
          <th class="py-2 pr-4 font-medium">
            Invité le
          </th>
          <th class="py-2" />
        </tr>
      </thead>
      <tbody>
        <AdminPlayerRow
          v-for="row in pageRows"
          :key="row.discordId"
          :row="row"
          :busy="busy"
          :running="runningOn(row.discordId)"
          :now="now"
          @act="action => act(row, action)"
        />
      </tbody>
    </table>
    <BasePagination v-model="page" :page-count="pageCount" class="mt-4" />
  </BaseSection>
</template>

<script setup lang="ts">
// Les joueurs et la whitelist, dans un seul tableau : une ligne par Discord ID,
// invité ou joueur. Lecture sans effet : ouvrir l'onglet ne fait avancer aucune
// partie. Voir specs/admin.md#gestion-des-joueurs.
import { TEAM_IDS } from '~~/shared/utils/teams'
import type { TeamId } from '~~/shared/utils/teams'
import type { PlayerAction, PlayerRow } from '~/components/AdminPlayerRow.vue'

const [roster, whitelist] = await Promise.all([useAdminPlayers(), useWhitelist()])
const { players, active, acting, skipCooldown, grantLife, grantKey, setTeam, resetPlayer } = roster
const { entries, add, adding, remove, removing } = whitelist

const failed = computed(() => roster.failed.value || whitelist.failed.value)
const firstLoad = computed(() => (roster.loading.value || whitelist.loading.value) && rows.value.length === 0)
const busy = computed(() => acting.value || removing.value !== null)
const now = useClockTick()

// Les invités d'abord, du dernier au premier ; puis les comptes que la
// whitelist ne porte plus, dont la partie reste en place.
const rows = computed<PlayerRow[]>(() => {
  const byDiscordId = new Map(players.value.map(player => [player.discordId, player]))
  const invited = entries.value.map(entry => ({
    discordId: entry.discordId,
    player: byDiscordId.get(entry.discordId) ?? null,
    username: entry.username,
    invitedAt: entry.createdAt,
    invitedTeam: entry.team,
    self: entry.self,
  }))
  const invitedIds = new Set(entries.value.map(entry => entry.discordId))
  const dropped = players.value
    .filter(player => !invitedIds.has(player.discordId))
    .map(player => ({
      discordId: player.discordId,
      player,
      username: player.username,
      invitedAt: null,
      invitedTeam: null,
      self: false,
    }))
  return [...invited, ...dropped]
})

// Pas de « personne » quand la lecture a échoué : ce serait la même phrase pour
// « aucun joueur » et « je ne sais pas ».
const emptyMessage = computed(() => (rows.value.length || failed.value ? null : 'Aucun Discord ID invité pour l\'instant.'))

const teamTotals = computed(() => [...TEAM_IDS, null].map(id => ({
  label: teamLabel(id),
  count: entries.value.filter(entry => entry.team === id).length,
})))

// ponytail: pagination côté client, les deux listes arrivent entières ; paginer le serveur si elles grossissent trop
const PAGE_SIZE = 20
const page = ref(1)
const pageCount = computed(() => Math.max(1, Math.ceil(rows.value.length / PAGE_SIZE)))
const pageRows = computed(() => rows.value.slice((page.value - 1) * PAGE_SIZE, page.value * PAGE_SIZE))
// Un retrait peut vider la dernière page : on recule plutôt que d'afficher du vide.
watch(pageCount, (count) => {
  page.value = Math.min(page.value, count)
})

// Aucune équipe présélectionnée : l'admin la choisit à chaque invitation, au
// lieu d'envoyer par mégarde tout le monde dans la première.
const NOT_CHOSEN = ''
const discordId = ref('')
const team = ref<string>(NOT_CHOSEN)
const teamOptions = [
  { value: NOT_CHOSEN, label: 'Choisir…' },
  ...TEAM_IDS.map(id => ({ value: id, label: teamLabel(id) })),
]
const ready = computed(() => discordId.value.trim() !== '' && team.value !== NOT_CHOSEN)
const addFailed = ref(false)
const actionFailed = ref(false)

async function submit(): Promise<void> {
  if (!ready.value) {
    return
  }

  const added = await add(discordId.value, team.value as TeamId)

  addFailed.value = !added
  if (added) {
    discordId.value = ''
    team.value = NOT_CHOSEN
  }
}

/** La ligne dont on vient de choisir un geste : elle seule montre son loader. */
const running = ref<{ discordId: string, action: PlayerAction } | null>(null)

function runningOn(id: string): PlayerAction | null {
  return running.value?.discordId === id ? running.value.action : null
}

/** Le geste choisi dans le menu d'une ligne. Les gestes de partie visent le compte, le retrait vise l'invitation. */
function send(row: PlayerRow, action: PlayerAction): Promise<boolean> {
  if (action === 'remove') {
    return remove(row.discordId)
  }
  const userId = row.player!.userId
  if (action.startsWith('team:')) {
    const chosen = action.slice('team:'.length)
    return setTeam(userId, chosen === 'none' ? null : chosen as TeamId)
  }
  const gestures = { skipCooldown, grantLife, grantKey, reset: resetPlayer } as const
  return gestures[action as keyof typeof gestures](userId)
}

async function act(row: PlayerRow, action: PlayerAction): Promise<void> {
  running.value = { discordId: row.discordId, action }
  actionFailed.value = !await send(row, action)
  running.value = null
}
</script>
