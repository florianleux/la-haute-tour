<template>
  <BossArena
    :boss="BOSS"
    :boss-hp="FULL_BOSS_HP - hits"
    :boss-max-hp="FULL_BOSS_HP"
    :player-name="user?.displayName ?? ''"
    :portrait="portrait"
    :lives="fighter.lives"
    :max-lives="rules.lives"
  >
    <BossFlagTrial
      :image="flag.image"
      :seconds-left="secondsLeft"
      :verdict="verdict === null ? null : { correct: verdict, answerLabel: flag.answerLabel }"
      :outcome="bossOutcome(fightState)"
      :model-value="typed"
      :action-label="over ? 'Rejouer' : 'Suivant'"
      @update:model-value="typed = $event"
      @submit="answer"
      @advance="next"
    />
  </BossArena>
</template>

<script setup lang="ts">
// Banc du combat contre le boss de l'étage 1 : l'arène commune (BossArena), les
// drapeaux au milieu. Tout se joue dans la page, sans partie réelle, mais avec
// les règles du jeu : le combat se juge par la mécanique du serveur. Les
// drapeaux sont ceux du premier combat, mélangés, lus à l'API admin et jamais
// importés : un import partirait dans le JS public, réponses comprises.
// Admin seulement. Voir specs/boss.md et specs/boss-etage1-drapeaux.md.
import type { BossFlag, BossFlagsResponse } from '~~/server/api/admin/boss-flags.get'
// Le juge du jeu, partagé : même tolérance qu'une question d'ascension.
import { isAnswerAccepted } from '~~/shared/utils/answers'
// Le jeu de règles, seul à connaître les vies. Un module pur, sans base ni
// requête : le banc le lit tel quel, faute de partie servie.
import { rulesForFloor } from '~~/server/utils/rules'
// La mécanique du combat, pure elle aussi : le banc juge comme le jeu.
import { bossFightOpening, bossFightState, bossOutcome, judgeTrial } from '~~/server/utils/mechanics'
import type { User } from '~~/server/db/schema'
import { BOSSES } from '~~/utils/bosses'

definePageMeta({ admin: true })

const rules = rulesForFloor(1)
const FULL_BOSS_HP = rules.bossHp
/** Julien Le Perse. */
const BOSS = BOSSES[1]!
const SECONDS = rules.bossTrialTimerMs / 1000

const { data: fight } = await useAsyncData(
  'boss-bench-flags',
  () => $fetch<BossFlagsResponse>('/api/admin/boss-flags', useApiFetchOptions()),
)

// ponytail: drapeau forcé en tête pour régler la taille : le seul en 2:1 du
// combat, donc le plus large (la Transnistrie). À retirer une fois le cadre dessiné.
const FORCED_FLAG = '419dd040b5e72e1a'

function shuffled(): BossFlag[] {
  return (fight.value?.flags ?? [])
    .map(entry => ({ entry, key: entry.image === FORCED_FLAG ? -1 : Math.random() }))
    .sort((a, b) => a.key - b.key)
    .map(({ entry }) => entry)
}

const { user } = await useCurrentUser()
const portrait = computed(() => playerPortrait(user.value?.gender ?? null))

// `useState` : tiré une fois au rendu serveur et repris tel quel au client —
// deux tirages donneraient deux écrans à l'hydratation.
const order = useState('boss-bench-order', shuffled)
const index = ref(0)

/** Le joueur au combat, tel que le serveur le stockerait : un premier combat, à vies pleines. */
type Fighter = Pick<User, 'bossHp' | 'lives' | 'bossAttemptNumber'>
const opening = (): Fighter => bossFightOpening({ lives: rules.lives, bossAttemptNumber: 0 }, rules)
const fighter = ref<Fighter>(opening())
/** Les épreuves justes : les PV montrés s'y relisent, comme au jeu (bossView). */
const hits = ref(0)
const typed = ref('')
/** Null tant que le drapeau attend sa réponse, puis juste ou faux. */
const verdict = ref<boolean | null>(null)
const secondsLeft = ref(SECONDS)

const flag = computed(() => order.value[index.value])
const fightState = computed(() => bossFightState(fighter.value, true))
const over = computed(() => fightState.value !== 'running')

function answer(): void {
  if (verdict.value !== null) {
    return
  }

  const correct = isAnswerAccepted(typed.value, flag.value.acceptedAnswers)
  verdict.value = correct
  hits.value += correct ? 1 : 0
  fighter.value = { ...fighter.value, ...judgeTrial(fighter.value, correct, rules, new Date()) }
}

function next(): void {
  if (over.value) {
    order.value = shuffled()
    index.value = 0
    fighter.value = opening()
    hits.value = 0
  }
  else {
    index.value++
  }

  typed.value = ''
  verdict.value = null
  secondsLeft.value = SECONDS
}

// Le chrono ne court que pendant la question, et répond à la place du joueur
// quand il tombe à zéro : un champ vide est une faute.
let timer: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  timer = setInterval(() => {
    if (verdict.value !== null) {
      return
    }
    secondsLeft.value--
    if (secondsLeft.value === 0) {
      answer()
    }
  }, 1000)
})
onBeforeUnmount(() => {
  if (timer) {
    clearInterval(timer)
  }
})
</script>
