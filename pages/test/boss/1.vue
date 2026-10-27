<template>
  <BossArena
    :boss="BOSS"
    :boss-hp="bossHp"
    :boss-max-hp="FULL_BOSS_HP"
    :player-name="user?.displayName ?? ''"
    :portrait="portrait"
    :lives="lives"
    :max-lives="rules.lives"
  >
    <BossFlagTrial
      :image="flag.image"
      :seconds-left="secondsLeft"
      :verdict="verdict === null ? null : { correct: verdict, answerLabel: flag.answerLabel }"
      :outcome="bossHp === 0 ? 'victory' : lives === 0 ? 'defeat' : null"
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
// drapeaux au milieu. Tout se joue dans la page, sans partie
// réelle — le combat n'existe pas encore côté serveur (#34 à #44). Les
// drapeaux sont ceux du premier combat, mélangés, lus à l'API admin et jamais
// importés : un import partirait dans le JS public, réponses comprises.
// Admin seulement. Voir specs/boss.md et specs/boss-etage1-drapeaux.md.
import type { BossFlag, BossFlagsResponse } from '~~/server/api/admin/boss-flags.get'
// Le juge du jeu, partagé : même tolérance qu'une question d'ascension.
import { isAnswerAccepted } from '~~/shared/utils/answers'
// Le jeu de règles, seul à connaître les vies. Un module pur, sans base ni
// requête : le banc le lit tel quel, faute de partie servie.
import { rulesForFloor } from '~~/server/utils/rules'
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
const bossHp = ref(FULL_BOSS_HP)
const lives = ref(rules.lives)
const typed = ref('')
/** Null tant que le drapeau attend sa réponse, puis juste ou faux. */
const verdict = ref<boolean | null>(null)
const secondsLeft = ref(SECONDS)

const flag = computed(() => order.value[index.value])
const over = computed(() => bossHp.value === 0 || lives.value === 0)

function answer(): void {
  if (verdict.value !== null) {
    return
  }

  verdict.value = isAnswerAccepted(typed.value, flag.value.acceptedAnswers)
  if (verdict.value) {
    bossHp.value--
  }
  else {
    lives.value--
  }
}

function next(): void {
  if (over.value) {
    order.value = shuffled()
    index.value = 0
    bossHp.value = FULL_BOSS_HP
    lives.value = rules.lives
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
