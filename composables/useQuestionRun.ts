import { useGameState } from './useGameState'
import { usePlay } from './usePlay'
import { formatCountdown } from '../utils/date'
import type { Ref } from 'vue'
import type { AnswerSource } from '~~/server/utils/mechanics'
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
  /** L'admin passe son attente. Sans effet pour un joueur non admin. */
  skipCooldown: () => Promise<void>
  /** Ouvre le coffre d'une question loot réussie. */
  openChest: () => Promise<void>
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
  /**
   * La page est-elle sous les yeux du joueur ? Fournie par un test ; sinon la
   * page écoute la fenêtre, côté client seulement.
   */
  visible?: Ref<boolean>
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
  const { next, answer, skipCooldown, openChest, failed: actionFailed, pending } = usePlay()

  const { state, failed: readFailed, loading, refresh } = await useGameState()

  const typed = ref('')
  const now = options.now ?? ref(Date.now())
  const visible = options.visible ?? ref(true)

  const secondsLeft = computed<number | null>(() => {
    const deadline = state.value?.question?.expiresAt
    if (!deadline) {
      return null
    }

    return Math.max(0, Math.ceil((new Date(deadline).getTime() - now.value) / 1000))
  })

  const waitRemaining = computed(
    () => formatCountdown(state.value?.cooldownUntil ?? '', now.value),
  )

  const cooldownOver = computed(() => {
    const deadline = state.value?.cooldownUntil
    return state.value?.phase === 'cooldown'
      && deadline !== null
      && deadline !== undefined
      && now.value >= new Date(deadline).getTime()
  })

  async function send(source: AnswerSource): Promise<void> {
    await answer(typed.value, source)

    // Le champ n'est vidé qu'une fois la réponse partie : un envoi refusé
    // effacerait ce que le joueur avait tapé.
    if (!actionFailed.value) {
      typed.value = ''
    }
  }

  /** L'envoi du joueur. Le départ de la page a le sien, plus bas. */
  async function submit(): Promise<void> {
    await send('player')
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

    /** Envoie ce qui est saisi, une fois pour la question servie. */
    function sendOnce(source: AnswerSource): void {
      const served = state.value?.question?.id
      if (!served || autoSubmitted === served) {
        return
      }

      autoSubmitted = served
      send(source)
    }

    watch(secondsLeft, (left) => {
      if (left === 0) {
        sendOnce('player')
      }
    }, { immediate: true })

    // La détection ne tourne que pendant qu'un timer tourne : jamais sur un
    // verdict, pendant l'attente, sur l'accueil ou le profil.
    // Voir specs/anti-triche.md#perte-de-focus.
    const leftAt = ref<number | null>(null)

    watch([visible, () => state.value?.question?.id], ([seen, served]) => {
      leftAt.value = seen || !served ? null : now.value
    })

    // Passé la tolérance, la réponse part en l'état. En deçà, il ne s'est rien
    // passé : un alt-tab rattrapé n'est pas de la triche.
    watch([now, leftAt], () => {
      const since = leftAt.value
      const grace = state.value?.question?.focusGraceMs

      if (since === null || grace === undefined || now.value - since < grace) {
        return
      }

      leftAt.value = null
      sendOnce('focusLoss')
    })

    // L'attente qui s'achève pendant que la page est ouverte : on relit l'état
    // plutôt que de laisser le joueur devant un décompte à zéro.
    watch(cooldownOver, (over) => {
      if (over) {
        refresh()
      }
    })

    watchTheWindow()
  }

  /** La fenêtre elle-même, quand personne ne pilote la visibilité à sa place. */
  function watchTheWindow(): void {
    if (options.visible || !import.meta.client) {
      return
    }

    const leave = (): void => {
      visible.value = false
    }
    const comeBack = (): void => {
      visible.value = document.visibilityState === 'visible'
    }

    window.addEventListener('blur', leave)
    window.addEventListener('focus', comeBack)
    document.addEventListener('visibilitychange', comeBack)

    onScopeDispose(() => {
      window.removeEventListener('blur', leave)
      window.removeEventListener('focus', comeBack)
      document.removeEventListener('visibilitychange', comeBack)
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
    skipCooldown,
    openChest,
    pending,
    actionFailed,
    readFailed,
    loading,
  }
}
