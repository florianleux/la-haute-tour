<template>
  <div class="contents">
    <!-- L'arrivée devant la porte attend d'abord les fichiers de ce boss, la
         première fois dans l'onglet : porte, introduction, combat. -->
    <AssetsLoadingScreen
      v-if="!bossAssets.done.value"
      :floor="floor"
    />

    <BossIntro
      v-else-if="boss && intro && stage === 'intro'"
      :boss="boss"
      :intro="intro"
      :backdrop="door.archColor"
      @end="fight"
    />

    <BossDoor
      v-else
      :key="arrivals"
      :door="door"
      :keys-placed="keysPlaced"
      :has-key="hasKey"
      :unlocked="arrival.solo || keysPlaced >= door.keyholes.length"
      :opened="opened"
      @place-key="placeKey"
      @open-door="opened = true"
      @enter="enter"
      @descend-to-camp="reset"
    />

    <!-- La situation à l'arrivée : tous les cas de specs/boss.md#arriver-devant-la-porte. -->
    <BaseTabs
      v-if="bossAssets.done.value && stage === 'door'"
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
// Un onglet par arrivée possible (SCENARIOS) : clés déjà posées par l'équipe,
// clé ou non dans l'inventaire du joueur, joueur sans équipe, porte déjà
// ouverte par lui. Poser sa clé et ouvrir se rejouent ensuite sur place. Entrer
// et Redescendre remettent le scénario : une nouvelle arrivée, la porte remontée
// de zéro (battants fermés, plongée annulée), sans battants qui se referment
// sous les yeux. Admin seulement. Voir specs/boss.md#porte-à-deux-clés.
//
// Entrer enchaîne les trois phases du boss : l'introduction de l'étage
// (BossIntro) s'il en a une au catalogue, puis le banc du combat.
import { BOSS_DOORS, type BossDoorEntry } from '~~/utils/bossDoors'
import { BOSSES } from '~~/utils/bosses'
import { BOSS_INTROS, introFor } from '~~/utils/bossIntros'

definePageMeta({ admin: true })

const floor = Number(useRoute().params.floor)

function noDoor(): never {
  throw createError({ statusCode: 404, statusMessage: `Pas de porte à l'étage ${floor}`, fatal: true })
}

const door: BossDoorEntry = BOSS_DOORS[floor] ?? noDoor()

/** Ce que le joueur trouve en arrivant devant la porte. */
interface Arrival {
  id: string
  label: string
  /** Clés déjà posées par l'équipe. */
  keysPlaced: number
  /** Le joueur a une clé dans son inventaire. */
  hasKey: boolean
  /** Joueur sans équipe : porte déverrouillée sans clé. */
  solo: boolean
  /** Le joueur a déjà ouvert cette porte. */
  opened: boolean
}

const SCENARIOS: Arrival[] = [
  { id: 'none-key', label: '0 posée · clé', keysPlaced: 0, hasKey: true, solo: false, opened: false },
  { id: 'none', label: '0 posée · sans clé', keysPlaced: 0, hasKey: false, solo: false, opened: false },
  { id: 'one-key', label: '1 posée · clé', keysPlaced: 1, hasKey: true, solo: false, opened: false },
  { id: 'one', label: '1 posée · sans clé', keysPlaced: 1, hasKey: false, solo: false, opened: false },
  { id: 'two-key', label: '2 posées · clé', keysPlaced: 2, hasKey: true, solo: false, opened: false },
  { id: 'two', label: '2 posées · sans clé', keysPlaced: 2, hasKey: false, solo: false, opened: false },
  { id: 'solo', label: 'Sans équipe', keysPlaced: 0, hasKey: false, solo: true, opened: false },
  { id: 'opened', label: 'Déjà ouverte', keysPlaced: 2, hasKey: false, solo: false, opened: true },
]

const scenario = ref(SCENARIOS[0]!.id)
const arrival = computed((): Arrival => SCENARIOS.find(({ id }) => id === scenario.value)!)
/** Le joueur du banc a posé sa clé : il en a une tant que la porte est verrouillée. */
const placed = ref(false)
/** Le joueur du banc a ouvert la porte déverrouillée. */
const opened = ref(arrival.value.opened)
/** Chaque remise du scénario remonte la porte, comme une arrivée. */
const arrivals = ref(0)

const keysPlaced = computed(() => arrival.value.keysPlaced + Number(placed.value))
const hasKey = computed(() => arrival.value.hasKey && !placed.value)

function reset(): void {
  placed.value = false
  opened.value = arrival.value.opened
  arrivals.value++
}

watch(scenario, reset)

const bossAssets = useBossAssetsLoadingScreen(floor)
const router = useRouter()

const boss = BOSSES[floor]
/** `?fought=N` : N combats déjà ouverts, la réplique de relance du suivant au lieu de l'introduction. */
const intro = introFor(BOSS_INTROS[floor], Number(useRoute().query.fought ?? 0))
/** La phase du boss que montre le banc : la porte, puis l'introduction. */
const stage = ref<'door' | 'intro'>('door')

/**
 * Le combat de l'étage, s'il a son banc (pages/test/boss/<étage>.vue, route
 * `test-boss-<étage>`) ; sinon une nouvelle arrivée devant la porte.
 */
function fight(): void {
  if (router.hasRoute(`test-boss-${floor}`)) {
    void navigateTo(`/test/boss/${floor}`)
    return
  }
  stage.value = 'door'
  reset()
}

function enter(): void {
  if (boss && intro) {
    stage.value = 'intro'
  }
  else {
    fight()
  }
}

function placeKey(): void {
  placed.value = true
}
</script>
