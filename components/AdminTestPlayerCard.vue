<template>
  <BaseTile>
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <p class="truncate font-semibold text-slate-100">
          {{ testPlayer.username }}
        </p>
        <BaseHint v-if="testPlayer.adventurerName">
          En jeu : {{ testPlayer.adventurerName }}
        </BaseHint>
        <BaseHint>
          Étage {{ testPlayer.floor }} — {{ testPlayer.floorSeen }}/{{ testPlayer.floorTotal }} vues,
          {{ testPlayer.lives }} vie(s), {{ phaseLabel(testPlayer.phase) }}
          <template v-if="inCooldown && remaining"> — {{ remaining }}</template>
        </BaseHint>
      </div>
      <BaseButton variant="ghost" :disabled="busy" @click="emit('remove')">
        Supprimer
      </BaseButton>
    </div>

    <div class="mt-4 grid gap-3 sm:grid-cols-2">
      <div class="flex items-end gap-2">
        <BaseSelect
          :model-value="testPlayer.team ?? NO_TEAM"
          label="Équipe"
          :options="teamOptions"
          :disabled="busy"
          class="grow"
          @update:model-value="value => emit('setTeam', value === NO_TEAM ? null : (value as TeamId))"
        />
      </div>

      <div class="flex items-end gap-2">
        <BaseSelect v-model="spell" label="Sort" :options="spellOptions" class="grow" />
        <BaseButton :disabled="busy" @click="emit('grantSpell', spell)">
          Donner
        </BaseButton>
      </div>

      <div class="flex items-end gap-2">
        <BaseSelect v-model="stepsValue" label="Questions" :options="stepOptions" class="grow" />
        <BaseButton :disabled="busy" @click="emit('advance', steps, true)">
          Justes
        </BaseButton>
        <BaseButton variant="ghost" :disabled="busy" @click="emit('advance', steps, false)">
          Fausses
        </BaseButton>
        <BaseButton variant="ghost" :disabled="busy" @click="emit('rewind', steps)">
          Enlever
        </BaseButton>
      </div>
    </div>

    <div class="mt-4 flex flex-wrap gap-2">
      <BaseButton variant="ghost" :disabled="busy" @click="emit('sendToCooldown')">
        Mettre en attente
      </BaseButton>
      <BaseButton variant="ghost" :disabled="busy || !inCooldown" @click="emit('skipCooldown')">
        Passer l'attente
      </BaseButton>
      <BaseButton variant="ghost" :disabled="busy" @click="emit('grantLife')">
        Rendre une vie
      </BaseButton>
      <BaseButton variant="ghost" :disabled="busy || testPlayer.ownsKey" @click="emit('grantKey')">
        Donner une clé
      </BaseButton>
      <BaseButton variant="ghost" :disabled="busy" @click="emit('reset')">
        Repartir de zéro
      </BaseButton>
    </div>
  </BaseTile>
</template>

<script setup lang="ts">
// Un joueur test et les gestes qui le placent dans la situation à éprouver.
// Des gestes nommés, jamais des champs : chacun laisse la base dans un état que
// le jeu sait produire. Voir specs/admin.md#réglages-dun-joueur-test.
import { SPELL_IDS } from '~~/shared/utils/spells'
import { TEAM_IDS } from '~~/shared/utils/teams'
import type { SpellId } from '~~/shared/utils/spells'
import type { TeamId } from '~~/shared/utils/teams'
import type { PlayerCard } from '~~/server/utils/players'

const props = defineProps<{
  testPlayer: PlayerCard
  /** Un geste est en vol, ici ou sur une autre fiche : tout attend la relecture. */
  busy: boolean
  /** L'horloge de la liste, pour que le délai restant descende tout seul. */
  now: number
}>()

const emit = defineEmits<{
  setTeam: [TeamId | null]
  grantSpell: [SpellId]
  advance: [number, boolean]
  rewind: [number]
  sendToCooldown: []
  skipCooldown: []
  grantLife: []
  grantKey: []
  reset: []
  remove: []
}>()

const spell = ref<SpellId>(SPELL_IDS[0])
const steps = ref(10)

const spellOptions = SPELL_IDS.map(id => ({ value: id, label: spellLabel(id) }))

// Sans équipe, deux joueurs test ne sont ni alliés ni ennemis : c'est le premier
// réglage à poser pour éprouver le PvP. Voir specs/equipes.md.
const NO_TEAM = 'none'
const teamOptions = [
  { value: NO_TEAM, label: teamLabel(null) },
  ...TEAM_IDS.map(id => ({ value: id, label: teamLabel(id) })),
]
// 24 et 49 posent le joueur juste avant le 1er et le 2e coffre : à recaler si
// `questionsPerChest` change (server/utils/rules.ts).
const stepOptions = [1, 5, 10, 24, 49].map(count => ({ value: String(count), label: `${count}` }))

const stepsValue = computed({
  get: () => String(steps.value),
  set: (value: string) => { steps.value = Number(value) },
})

const { inCooldown, remaining } = usePlayerCooldown(toRef(props, 'testPlayer'), toRef(props, 'now'))
</script>
