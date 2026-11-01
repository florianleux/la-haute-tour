<template>
  <tr class="border-t border-slate-800 text-sm">
    <td class="py-2 pr-4">
      <div class="flex items-center gap-2">
        <BaseAvatar
          v-if="player"
          small
          :src="discordAvatarUrl(player.discordId, player.avatar)"
          :alt="player.username"
        />
        <div class="min-w-0">
          <p class="truncate font-semibold text-slate-100">
            {{ player?.username ?? row.username ?? '—' }}
            <span v-if="player?.adventurerName" class="font-normal text-slate-400">· {{ player.adventurerName }}</span>
          </p>
          <p class="font-mono text-xs text-slate-500">
            {{ row.discordId }}
          </p>
        </div>
      </div>
    </td>
    <td class="py-2 pr-4">
      {{ teamLabel(player ? player.team : row.invitedTeam) }}
    </td>
    <template v-if="player">
      <td class="py-2 pr-4 whitespace-nowrap">
        {{ player.floor }} <span class="text-slate-500">· {{ player.floorSeen }}/{{ player.floorTotal }}</span>
      </td>
      <td class="py-2 pr-4 whitespace-nowrap">
        {{ phaseLabel(player.phase) }}
        <span v-if="inCooldown && remaining" class="text-slate-500">· {{ remaining }}</span>
      </td>
      <td class="py-2 pr-4">
        {{ player.lives }}
      </td>
      <!-- Zéro contestation n'est pas une nouvelle : la case reste vide. -->
      <td class="py-2 pr-4 text-amber-400">
        {{ player.pendingDisputes || '' }}
      </td>
      <td class="py-2 pr-4 whitespace-nowrap text-slate-400">
        {{ player.lastPlayedDay ? formatDay(player.lastPlayedDay) : '—' }}
      </td>
    </template>
    <td v-else colspan="5" class="py-2 pr-4 text-slate-500">
      Pas encore connecté
    </td>
    <td class="py-2 pr-4 whitespace-nowrap text-slate-500">
      <template v-if="row.invitedAt">
        {{ formatDay(row.invitedAt) }}
      </template>
      <span v-else class="text-amber-400">Hors whitelist</span>
    </td>
    <td class="py-2 text-right">
      <BaseMenu
        :items="items"
        :label="`Actions sur ${player?.username ?? row.discordId}`"
        :loading="running !== null"
        @select="$emit('act', $event)"
      />
    </td>
  </tr>
</template>

<script setup lang="ts">
import { TEAM_IDS } from '~~/shared/utils/teams'
import type { TeamId } from '~~/shared/utils/teams'
import type { PlayerCard } from '~~/server/utils/players'
import type { MenuItem } from '~/components/ui/BaseMenu.vue'

/**
 * Une ligne du tableau : un Discord ID, avec ce que la whitelist et le compte
 * en disent. L'un des deux peut manquer — invité pas encore venu, ou joueur
 * retiré de la whitelist dont la partie reste en place.
 */
export interface PlayerRow {
  discordId: string
  player: PlayerCard | null
  /** Pseudo Discord connu de la whitelist, avant même le compte. */
  username: string | null
  /** Null hors whitelist. */
  invitedAt: string | null
  invitedTeam: TeamId | null
  /** L'admin qui lit : il ne peut pas se retirer. */
  self: boolean
}

export type PlayerAction = 'skipCooldown' | 'grantLife' | 'grantKey' | 'reset' | 'remove' | `team:${TeamId | 'none'}`

const props = defineProps<{
  row: PlayerRow
  /** Un geste est en vol, ici ou sur une autre ligne : tout attend la relecture. */
  busy: boolean
  /** Le geste lancé depuis cette ligne, null sinon. */
  running: PlayerAction | null
  /** L'horloge du tableau, pour que le délai restant descende tout seul. */
  now: number
}>()

defineEmits<{ act: [PlayerAction] }>()

const player = computed(() => props.row.player)

const { inCooldown, remaining } = usePlayerCooldown(player, toRef(props, 'now'))

const items = computed<MenuItem<PlayerAction>[]>(() => {
  const card = props.row.player
  const off = props.busy
  const gestures: MenuItem<PlayerAction>[] = card
    ? [
        { id: 'skipCooldown', label: 'Passer l\'attente', disabled: off || !inCooldown.value },
        { id: 'grantLife', label: 'Rendre une vie', disabled: off },
        { id: 'grantKey', label: 'Donner une clé', disabled: off || card.ownsKey },
        // « Sans équipe » est un choix comme un autre : l'appartenance est
        // facultative, et l'admin doit pouvoir l'ôter. Voir specs/equipes.md.
        ...[...TEAM_IDS, null].map((team, index) => ({
          id: `team:${team ?? 'none'}` as PlayerAction,
          label: team ? `Équipe : ${teamLabel(team)}` : 'Retirer de l\'équipe',
          disabled: off || card.team === team,
          separated: index === 0,
        })),
        { id: 'reset', label: 'Repartir de zéro', danger: true, separated: true, disabled: off },
      ]
    : []
  return [
    ...gestures,
    {
      id: 'remove',
      label: 'Retirer de la whitelist',
      danger: true,
      separated: true,
      disabled: off || props.row.self || props.row.invitedAt === null,
    },
  ]
})
</script>
