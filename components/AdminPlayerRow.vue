<template>
  <!-- Un clic sur la ligne d'un joueur la déplie : son sac et sa poche. Le
       bouton invisible sur la case Joueur porte le geste au clavier ; son clic
       remonte à la ligne comme celui de la souris. -->
  <tr
    class="border-t border-slate-800 text-sm"
    :class="{ 'cursor-pointer hover:bg-slate-800/40': player }"
    @click="player && (expanded = !expanded)"
  >
    <td class="relative py-2 pr-4">
      <BaseSurfaceButton
        v-if="player"
        :label="`Sac et sorts de ${player.username}`"
        :aria-expanded="expanded"
      />
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
            <span v-if="!row.invitedAt" class="font-sans text-amber-400">· Hors whitelist</span>
          </p>
          <!-- Sur mobile, les colonnes cachées passent en seconde ligne. -->
          <p class="mt-0.5 text-xs text-slate-400 sm:hidden">
            {{ cells ? [cells.team, `Étage ${cells.floor}`, cells.phase, cells.lastPlayed].join(' · ') : `${team} · Pas encore connecté` }}
          </p>
        </div>
      </div>
    </td>
    <td :class="WIDE_CELL">
      {{ team }}
    </td>
    <template v-if="cells">
      <td :class="WIDE_CELL" class="whitespace-nowrap">
        {{ cells.floor }}
      </td>
      <td :class="WIDE_CELL" class="whitespace-nowrap">
        {{ cells.phase }}
      </td>
      <td :class="WIDE_CELL" class="whitespace-nowrap text-slate-400">
        {{ cells.lastPlayed }}
      </td>
    </template>
    <td v-else colspan="3" :class="WIDE_CELL" class="text-slate-500">
      Pas encore connecté
    </td>
    <td class="py-2 text-right" @click.stop>
      <BaseMenu
        :items="items"
        :label="`Actions sur ${player?.username ?? row.discordId}`"
        :loading="running !== null"
        @select="$emit('act', $event)"
      />
    </td>
  </tr>
  <tr v-if="player && expanded" class="text-sm">
    <td colspan="6" class="pb-4 pl-2 pt-2 sm:pl-10">
      <div class="flex flex-wrap items-center gap-x-8 gap-y-3">
        <div class="flex items-center gap-2">
          <img
            v-for="(item, index) in player.items"
            :key="index"
            :src="itemLabel(item).image"
            :alt="itemLabel(item).name"
            :title="itemLabel(item).name"
            class="size-6 object-contain"
          >
          <span v-if="!player.items.length" class="text-slate-500">Sac vide</span>
        </div>
        <div class="flex items-center gap-2.5">
          <div
            v-for="{ spell, count } in player.spells"
            :key="spell"
            class="@container relative size-7"
            :title="spellLabel(spell)"
          >
            <SpellMedallion
              :spell="spell"
              face="mixed"
              :alt="spellLabel(spell)"
              class="size-full"
              fallback-class="border-2 border-slate-500 text-[50cqw] text-slate-300"
            />
            <SpellCountBadge :count="count" />
          </div>
          <span v-if="!player.spells.length" class="text-slate-500">Aucun sort</span>
        </div>
        <span class="text-slate-400">Coffres : {{ player.chestsOpened }} / {{ player.chestsOffered }}</span>
      </div>
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

const expanded = ref(false)

const { inCooldown, remaining } = usePlayerCooldown(player, toRef(props, 'now'))

/** Une colonne que le mobile cache : son contenu passe sous le pseudo. */
const WIDE_CELL = 'hidden py-2 pr-4 sm:table-cell'

const team = computed(() => teamLabel(player.value ? player.value.team : props.row.invitedTeam))

// Ce que disent les colonnes d'un joueur venu, écrit une fois pour le tableau
// et pour la seconde ligne du mobile.
const cells = computed(() => {
  const card = player.value
  if (!card) {
    return null
  }
  return {
    team: team.value,
    floor: `${card.floor} · ${card.floorSeen}/${card.floorTotal}`,
    phase: inCooldown.value && remaining.value ? `${phaseLabel(card.phase)} · ${remaining.value}` : phaseLabel(card.phase),
    lastPlayed: card.lastPlayedDay ? formatDay(card.lastPlayedDay) : '—',
  }
})

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
