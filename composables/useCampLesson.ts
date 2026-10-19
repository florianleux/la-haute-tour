import { toRaw } from 'vue'
import type { Ref } from 'vue'
import type { GameState } from '~~/server/utils/game'
import type { LessonId } from '~~/shared/utils/lessons'
import type { TeamId } from '~~/shared/utils/teams'
import type { DialogueChoices } from '~~/utils/dialogue'
import type { LessonAwait, LessonLine } from '~~/utils/lessons'

export interface CampLesson {
  /** La réplique de Michel en cours, null quand il se tait. */
  line: Ref<LessonLine | null>
  /** Les réponses que Michel propose sous sa réplique, null s'il n'en propose pas. */
  choices: Ref<DialogueChoices | null>
  /** Passe à la réplique suivante ; Michel se tait après la dernière. */
  next: () => void
  /**
   * Le joueur vient de faire ce geste (cliquer un objet, utiliser le Fromage,
   * refermer une boîte) : la leçon passe à la suite si c'est ce que la
   * réplique attendait, et ne bouge pas sinon.
   */
  done: (performed: Exclude<LessonAwait, 'pause' | 'ascent'>) => void
  /** Michel, cliqué hors leçon, propose de rejouer une leçon déjà vue. */
  offer: () => void
  /** Le joueur répond à la proposition de Michel. */
  choose: (rank: number) => void
  /** Le clic sur l'au revoir de Michel : la leçon du camp est vue, datée par le serveur. */
  finish: () => Promise<void>
}

/** Comment Michel nomme chaque leçon quand il propose de la rejouer. */
const LESSON_NAMES: Record<LessonId, string> = { camp: 'Le camp' }

/**
 * Michel au camp : la leçon du camp, jouée d'elle-même à la première arrivée,
 * au repos — la sortie de l'introduction — et rejouée à la demande. Tout ce qui
 * compte se lit dans l'état servi : la leçon vue, et le Fromage encore dans le
 * sac, qui dit où elle reprend. Voir specs/ecrans.md#leçons-de-michel.
 */
export function useCampLesson(state: Ref<GameState | null>, team: Ref<TeamId | null>): CampLesson {
  const lines = ref<LessonLine[] | null>(null)
  const index = ref(0)
  const choices = ref<DialogueChoices | null>(null)

  const line = computed(() => lines.value?.[index.value] ?? null)

  function play(played: LessonLine[], from = 0): void {
    lines.value = played
    index.value = from
  }

  function stop(): void {
    lines.value = null
    choices.value = null
  }

  function next(): void {
    if (choices.value) {
      return
    }
    index.value += 1
    if (index.value >= (lines.value?.length ?? 0)) {
      stop()
    }
  }

  function done(performed: Exclude<LessonAwait, 'pause' | 'ascent'>): void {
    if (line.value?.awaits === performed) {
      next()
    }
  }

  // Côté navigateur seulement : le serveur ne joue pas de leçon.
  if (!import.meta.server) {
    // Michel se fait attendre : la pause passe d'elle-même. Rien ne l'abrège
    // — une leçon ne se passe pas —, sauf à quitter le camp, qui démonte la page.
    let pausing: ReturnType<typeof setTimeout> | undefined
    watch(line, (now) => {
      clearTimeout(pausing)
      if (now?.awaits === 'pause') {
        pausing = setTimeout(next, LESSON_PAUSE_MS)
      }
    })
    onScopeDispose(() => clearTimeout(pausing))

    // La leçon part dès l'arrivée, sur sa pause : le camp ne répond déjà plus.
    // Le sac se lit pendant ce temps. Le Fromage déjà donné (une leçon
    // rechargée), elle saute à la suite du don — tant que la pause court
    // encore. Si la lecture échoue, elle part du début : le don, refusé faute
    // de Fromage, la remettra sur ses rails (voir InventoryOverlay).
    watch(() => isAtRest(state.value) && state.value?.lessonsDone.includes('camp') === false, (due) => {
      if (!due || lines.value) {
        return
      }
      const camp = campLesson({ team: team.value })
      play(camp)
      void fetchItems().then(({ items }) => {
        // `toRaw` : la ref rend un proxy, jamais le tableau joué lui-même.
        if (toRaw(lines.value) === camp && index.value === 0) {
          index.value = lessonStart(camp, items.includes('CHEESE'))
        }
      }, () => {})
    }, { immediate: true })
  }

  const lessonsDone = computed(() => state.value?.lessonsDone ?? [])

  function offer(): void {
    const [first, ...others] = lessonsDone.value.map(lesson => LESSON_NAMES[lesson])
    if (lines.value || !first) {
      return
    }
    // TODO(texte) : réplique provisoire, Flo l'écrira.
    play([{ text: 'Tu veux que je te réexplique quelque chose ?', spotlight: 'michel' }])
    choices.value = [first, ...others, 'Non merci']
  }

  function choose(rank: number): void {
    const lesson = lessonsDone.value[rank]
    stop()
    if (lesson === 'camp') {
      play(replayedLesson(campLesson({ team: team.value })))
    }
  }

  // Seule la vraie leçon finit sur l'au revoir qui attend l'ascension :
  // rejouée, elle n'attend plus rien, et ne date donc rien.
  async function finish(): Promise<void> {
    await $fetch('/api/profile/lessons', { method: 'POST', body: { lesson: 'camp' satisfies LessonId } })
    stop()
  }

  return { line, choices, next, done, offer, choose, finish }
}
