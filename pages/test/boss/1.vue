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
    <!-- ponytail: cadre provisoire, écrit dans la page en attendant son dessin ;
         il deviendra un composant avec lui. Au milieu : le chrono, le drapeau,
         le champ, puis le verdict. Tout est en `dvh`, réglé sur une fenêtre de
         880 px de haut (1dvh = 8,8 px) : le cadre garde sa place et sa part de
         l'écran à toute taille. L'enveloppe, invisible, fait 101,8dvh (896 px) :
         le bouton, dimensionné en `cqw`, s'y ancre. -->
    <div class="fixed left-1/2 top-[14dvh] z-10 w-[101.8dvh] -translate-x-1/2 @container text-center">
      <!-- Le cadre visible, en portrait 8:9 : 54,5dvh de large, soit 480×540 px.
           Ses textes, en `cqw`, se règlent sur lui, marges de 0,9dvh déduites
           (464 px). Le drapeau y fait 43,3dvh (381 px). Le vide en haut et en
           bas attend le chrono rond et un message. -->
      <div class="mx-auto flex aspect-8/9 w-[54.5dvh] flex-col items-center justify-center gap-[1.8dvh] rounded-[1.8dvh] bg-amber-100 px-[0.9dvh] @container">
        <PlayText
          v-if="verdict === null"
          role="timer"
          as="span"
          class="text-[4cqw] text-amber-600"
        >
          {{ secondsLeft }}
        </PlayText>
        <VerdictMark
          v-else
          :correct="verdict"
        />

        <template v-if="verdict === null">
          <img
            :src="`/images/boss/1/flags/${flag.image}.webp`"
            alt="Le drapeau à reconnaître"
            class="aspect-2/1 w-[43.3dvh] object-contain drop-shadow-md"
          >
          <BaseParchmentInput
            :key="flag.image"
            v-model="typed"
            @submit="answer"
          />
        </template>

        <template v-else>
          <PlayText
            role="headline"
            :class="headline.ink"
          >
            {{ headline.text }}
          </PlayText>
          <PlayText
            role="answer"
            class="text-amber-800"
          >
            {{ flag.answerLabel }}
          </PlayText>
        </template>
      </div>

      <BaseCardButton
        :label="verdict === null ? 'Valider' : over ? 'Rejouer' : 'Suivant'"
        anchor="image-bottom"
        @click="verdict === null ? answer() : next()"
      />
    </div>
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
// ponytail: les PV du boss et le chrono d'une épreuve ne sont pas encore dans
// le jeu de règles — le chrono est propre à chaque boss (specs/boss.md). Ils y
// entrent avec le vrai combat (#34 à #44) ; ce banc les lira alors comme les vies.
const FULL_BOSS_HP = 7
/** Julien Le Perse. */
const BOSS = BOSSES[1]!
const SECONDS = 30

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

const headline = computed(() => {
  if (bossHp.value === 0) {
    return { text: 'Victoire !', ink: 'text-emerald-700' }
  }
  if (lives.value === 0) {
    return { text: 'Défaite...', ink: 'text-rose-700' }
  }
  return verdict.value
    ? { text: 'Correct !', ink: 'text-emerald-700' }
    : { text: 'Incorrect...', ink: 'text-rose-700' }
})

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
