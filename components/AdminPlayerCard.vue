<template>
  <BaseTile>
    <div class="flex items-center gap-3">
      <BaseAvatar :src="discordAvatarUrl(player.discordId, player.avatar)" :alt="player.username" />
      <div class="min-w-0">
        <p class="truncate font-semibold text-slate-100">
          {{ player.username }}
        </p>
        <BaseHint>
          Étage {{ player.floor }} — {{ player.floorSeen }}/{{ player.floorTotal }} vues
        </BaseHint>
      </div>
    </div>

    <dl class="mt-4 space-y-1 text-sm">
      <div class="flex justify-between gap-4">
        <dt class="text-slate-500">
          Phase
        </dt>
        <dd>{{ phaseLabel(player.phase) }}</dd>
      </div>
      <div class="flex justify-between gap-4">
        <dt class="text-slate-500">
          Vies
        </dt>
        <dd>{{ player.lives }}</dd>
      </div>
      <div class="flex justify-between gap-4">
        <dt class="text-slate-500">
          Équipe
        </dt>
        <dd>{{ teamLabel(player.team) }}</dd>
      </div>
      <div v-if="waiting && remaining" class="flex justify-between gap-4">
        <dt class="text-slate-500">
          Déblocage dans
        </dt>
        <dd>{{ remaining }}</dd>
      </div>
      <!-- Zéro contestation n'est pas une nouvelle : la ligne disparaît. -->
      <div v-if="player.pendingDisputes > 0" class="flex justify-between gap-4">
        <dt class="text-slate-500">
          Contestations
        </dt>
        <dd class="text-amber-400">
          {{ player.pendingDisputes }} en cours
        </dd>
      </div>
    </dl>

    <div class="mt-4 flex flex-wrap gap-2">
      <BaseButton
        variant="ghost"
        :loading="running === 'skipCooldown'"
        :disabled="!waiting || busy"
        @click="$emit('skipCooldown')"
      >
        Passer l'attente
      </BaseButton>
      <BaseButton
        variant="ghost"
        :loading="running === 'grantLife'"
        :disabled="busy"
        @click="$emit('grantLife')"
      >
        Rendre une vie
      </BaseButton>
      <BaseButton
        variant="ghost"
        :loading="running === 'reset'"
        :disabled="busy"
        @click="$emit('reset')"
      >
        Repartir de zéro
      </BaseButton>
    </div>

    <BaseSelect
      :model-value="player.team ?? NO_TEAM"
      class="mt-3 w-full"
      :options="teamOptions"
      :disabled="busy"
      aria-label="Équipe du joueur"
      @update:model-value="value => $emit('setTeam', value === NO_TEAM ? null : (value as TeamId))"
    />
  </BaseTile>
</template>

<script setup lang="ts">
import { TEAM_IDS } from '~~/shared/utils/teams'
import type { TeamId } from '~~/shared/utils/teams'
import type { PlayerCard } from '~~/server/utils/players'

const props = defineProps<{
  player: PlayerCard
  /** Un geste est en vol, ici ou sur une autre fiche : tout attend la relecture. */
  busy: boolean
  /** Le geste lancé depuis cette fiche — lui seul montre son loader. */
  running: 'skipCooldown' | 'grantLife' | 'reset' | null
  /** L'horloge de la liste, pour que le délai restant descende tout seul. */
  now: number
}>()

defineEmits<{ skipCooldown: [], grantLife: [], reset: [], setTeam: [TeamId | null] }>()

// « Sans équipe » est un choix comme un autre : l'appartenance est facultative,
// et l'admin doit pouvoir l'ôter. Voir specs/equipes.md.
const NO_TEAM = 'none'

const teamOptions = [
  { value: NO_TEAM, label: teamLabel(null) },
  ...TEAM_IDS.map(id => ({ value: id, label: teamLabel(id) })),
]

const { waiting, remaining } = usePlayerWait(toRef(props, 'player'), toRef(props, 'now'))
</script>
