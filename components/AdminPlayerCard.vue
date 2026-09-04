<script setup lang="ts">
import type { PlayerCard } from '~~/server/utils/players'

const props = defineProps<{
  player: PlayerCard
  /** Un geste est en vol : les deux boutons attendent la relecture. */
  busy: boolean
  /** L'horloge de la liste, pour que le délai restant descende tout seul. */
  now: number
}>()

defineEmits<{ skipCooldown: [], grantLife: [] }>()

const waiting = computed(() => props.player.phase === 'cooldown')

// « terminée » plutôt qu'un délai quand l'échéance vient de passer : la phase du
// serveur ne bougera qu'à la prochaine lecture du joueur.
const remaining = computed(() =>
  props.player.cooldownUntil ? formatWait(props.player.cooldownUntil, props.now) : null,
)
</script>

<template>
  <div class="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
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
        :disabled="!waiting || busy"
        @click="$emit('skipCooldown')"
      >
        Passer l'attente
      </BaseButton>
      <BaseButton variant="ghost" :disabled="busy" @click="$emit('grantLife')">
        Rendre une vie
      </BaseButton>
    </div>
  </div>
</template>
