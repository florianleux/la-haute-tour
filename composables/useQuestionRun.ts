import { useGameState } from './useGameState'
import { usePlay } from './usePlay'
import { formatRemaining } from '../utils/date'
import type { Ref } from 'vue'
import type { GameState } from '~~/server/utils/game'

export interface QuestionRun {
  /** L'état de jeu tel que le serveur l'a rendu. La page ne fait que l'afficher. */
  state: Ref<GameState | null>
  /** Ce que le joueur a tapé, conservé tant que la réponse n'est pas partie. */
  typed: Ref<string>
  /** Secondes restantes sur la question en cours, null hors question. */
  secondsLeft: Ref<number | null>
  /** Temps restant avant la reprise, tel qu'on le lit sur l'écran d'attente. */
  waitRemaining: Ref<string>
  /** Envoie la réponse saisie. */
  submit: () => Promise<void>
  /** Passe à la suite : commencer, question suivante, démarrer un rattrapage. */
  advance: () => Promise<void>
  pending: Ref<boolean>
  /** Une action a échoué. */
  actionFailed: Ref<boolean>
  /** L'état n'a pas pu être lu. */
  readFailed: Ref<boolean>
  /** Une relecture est en cours. */
  loading: Ref<boolean>
}

export interface QuestionRunOptions {
  /**
   * Horloge, en millisecondes. Fournie par un test pour piloter le temps ;
   * sinon la page en démarre une, côté client seulement.
   */
  now?: Ref<number>
}

/** Cadence du décompte affiché : assez fine pour que la seconde ne saute pas. */
const TICK_MS = 250

/**
 * Ce qu'il faut pour jouer une question : le décompte, l'envoi, le passage à la
 * suite, et les deux règles de temps qui vont avec — envoyer ce qui est saisi
 * quand le chrono tombe à zéro, relire l'état quand l'attente s'achève.
 *
 * Le chrono n'est qu'un rendu de l'échéance fixée par le serveur : l'arbitrage
 * reste serveur, le trafiquer ne gagne rien. Voir specs/anti-triche.md.
 */
export async function useQuestionRun(options: QuestionRunOptions = {}): Promise<QuestionRun> {
  // Tout ce qui exige le contexte de l'appelant se prend avant le premier await :
  // après, ni la portée réactive ni l'instance Nuxt ne sont plus les siennes.
  // Un composable Nuxt appelé après l'await lève « called outside of setup ».
  const owner = getCurrentScope()
  const { next, answer, failed: actionFailed, pending } = usePlay()

  const { state, failed: readFailed, loading, refresh } = await useGameState()

  const typed = ref('')
  const now = options.now ?? ref(Date.now())

  const secondsLeft = computed<number | null>(() => {
    const deadline = state.value?.question?.expiresAt
    if (!deadline) {
      return null
    }

    return Math.max(0, Math.ceil((new Date(deadline).getTime() - now.value) / 1000))
  })

  const waitRemaining = computed(
    () => formatRemaining(state.value?.cooldownUntil ?? '', now.value),
  )

  const cooldownOver = computed(() => {
    const deadline = state.value?.cooldownUntil
    return state.value?.phase === 'cooldown'
      && deadline !== null
      && deadline !== undefined
      && now.value >= new Date(deadline).getTime()
  })

  async function submit(): Promise<void> {
    await answer(typed.value)

    // Le champ n'est vidé qu'une fois la réponse partie : un envoi refusé
    // effacerait ce que le joueur avait tapé.
    if (!actionFailed.value) {
      typed.value = ''
    }
  }

  async function advance(): Promise<void> {
    typed.value = ''
    await next()
  }

  /** Les effets, créés dans la portée de l'appelant pour être libérés avec elle. */
  function watchTheClock(): void {
    if (!options.now && import.meta.client) {
      const ticker = setInterval(() => {
        now.value = Date.now()
      }, TICK_MS)

      onScopeDispose(() => clearInterval(ticker))
    }

    // À zéro, on envoie ce qui est saisi : le serveur tranchera de toute façon
    // que c'est hors délai. Sans ça l'écran resterait figé sur une question
    // morte — y compris à l'arrivée sur une question déjà expirée, d'où
    // l'immediate.
    //
    // Une fois par question servie, et non « tant que pending est faux » : le
    // watcher n'attend pas l'envoi, donc plusieurs passages pourraient le
    // franchir avant que la première réponse soit partie.
    let autoSubmitted: string | null = null

    watch(secondsLeft, (left) => {
      const served = state.value?.question?.id
      if (left === 0 && served && autoSubmitted !== served) {
        autoSubmitted = served
        submit()
      }
    }, { immediate: true })

    // L'attente qui s'achève pendant que la page est ouverte : on relit l'état
    // plutôt que de laisser le joueur devant un décompte à zéro.
    watch(cooldownOver, (over) => {
      if (over) {
        refresh()
      }
    })
  }

  if (!owner) {
    watchTheClock()
  }
  else if (owner.active) {
    owner.run(watchTheClock)
  }
  // Portée déjà arrêtée : l'appelant a disparu pendant la lecture de l'état,
  // brancher des effets sur rien ne ferait que les laisser traîner.

  return {
    state,
    typed,
    secondsLeft,
    waitRemaining,
    submit,
    advance,
    pending,
    actionFailed,
    readFailed,
    loading,
  }
}
