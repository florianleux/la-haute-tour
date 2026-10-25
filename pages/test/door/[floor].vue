<template>
  <div class="contents">
    <BossDoor
      :door="door"
      :keys-placed="keysPlaced"
      :has-key="hasKey"
      :open="keysPlaced >= door.keyholes.length"
      @place-key="placeKey"
      @enter="reset"
      @descend-to-camp="reset"
    />

    <!-- Le scénario d'arrivée : combien de clés l'équipe a déjà posées. -->
    <BaseTabs
      v-model="scenario"
      :tabs="SCENARIOS"
      class="fixed right-4 top-4 z-20 rounded-lg bg-slate-950/70"
    />
  </div>
</template>

<script setup lang="ts">
// Banc de design de l'écran de porte : même composant qu'en jeu (BossDoor),
// mais un état local plutôt qu'une vraie porte — la porte n'existe pas encore
// côté serveur (#34 à #44). Une route pour toutes les portes : /test/door/1
// montre la Porte de la Lune, un étage sans porte au catalogue répond 404.
//
// Trois arrivées : 0 clé, 1 clé (posée par un coéquipier), 2 clés. En 0 et 1,
// le joueur du banc a une clé à poser. Entrer et Redescendre remettent le
// scénario. Admin seulement. Voir specs/boss.md#porte-à-deux-clés.
import { BOSS_DOORS, type BossDoorEntry } from '~~/utils/bossDoors'

definePageMeta({ admin: true })

const floor = Number(useRoute().params.floor)

function noDoor(): never {
  throw createError({ statusCode: 404, statusMessage: `Pas de porte à l'étage ${floor}`, fatal: true })
}

const door: BossDoorEntry = BOSS_DOORS[floor] ?? noDoor()

/** Combien de clés l'équipe a déjà posées à l'arrivée du joueur. */
type Scenario = '0' | '1' | '2'

const SCENARIOS: { id: Scenario, label: string }[] = [
  { id: '0', label: '0 clé' },
  { id: '1', label: '1 clé' },
  { id: '2', label: '2 clés' },
]

const scenario = ref<Scenario>('0')
/** Le joueur du banc a posé sa clé : il en a une tant que la porte est fermée. */
const placed = ref(false)

const keysPlaced = computed(() => Number(scenario.value) + Number(placed.value))
const hasKey = computed(() => !placed.value && keysPlaced.value < door.keyholes.length)

function reset(): void {
  placed.value = false
}

watch(scenario, reset)

function placeKey(): void {
  placed.value = true
}
</script>
