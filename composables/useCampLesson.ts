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
   * refermer une boîte, lancer un sort sur soi) : la leçon passe à la suite si
   * c'est ce que la réplique attendait, et ne bouge pas sinon.
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
const LESSON_NAMES: Record<LessonId, string> = { camp: 'Le camp', fall: 'La chute', recovery: 'Le rattrapage', spellbook: 'Le Grimoire' }

/**
 * Michel au camp : chaque leçon jouée d'elle-même à son moment (dueLesson), une
 * à la fois, et rejouée à la demande. Tout ce qui compte se lit dans l'état
 * servi : les leçons vues, les chiffres du rattrapage, le premier lancer encore
 * à faire, et le Fromage encore dans le sac, qui dit où la leçon du camp
 * reprend. Une leçon datée relit l'état (`refresh`) : la suivante en part.
 * Voir specs/ecrans.md#leçons-de-michel.
 */
export function useCampLesson(
  state: Ref<GameState | null>,
  team: Ref<TeamId | null>,
  refresh: () => Promise<void>,
): CampLesson {
  const lines = ref<LessonLine[] | null>(null)
  const index = ref(0)
  const choices = ref<DialogueChoices | null>(null)
  /** La leçon jouée d'elle-même, à dater à sa fin ; null sur un rejeu, qui ne date rien. */
  const playing = ref<LessonId | null>(null)

  const lessonsDone = computed(() => state.value?.lessonsDone ?? [])

  const line = computed(() => lines.value?.[index.value] ?? null)

  /**
   * Les répliques de chaque leçon, telles que l'état servi les permet : null
   * quand il manque de quoi la jouer. Le rattrapage n'a ses chiffres que tant
   * qu'il n'a pas commencé — ailleurs, ni déclenché ni rejoué.
   */
  const LESSON_LINES: Record<LessonId, () => LessonLine[] | null> = {
    camp: () => campLesson({ team: team.value }),
    fall: fallLesson,
    recovery: () => state.value?.nextRecovery ? recoveryLesson(state.value.nextRecovery) : null,
    spellbook: () => spellbookLesson({ team: team.value, guided: state.value?.firstCastPending ?? false }),
  }

  function play(played: LessonLine[], from = 0): void {
    lines.value = played
    index.value = from
  }

  function stop(): void {
    lines.value = null
    choices.value = null
    playing.value = null
  }

  /**
   * La leçon finit : Michel se tait et, si elle s'est jouée d'elle-même, elle
   * est datée puis l'état relu — c'est lui qui dit la leçon suivante et rend
   * « Commencer ». Rejouée, elle ne date rien. Une date qui ne s'écrit pas
   * laisse la leçon à revoir : elle se rejouera, rien de plus.
   */
  async function complete(): Promise<void> {
    const lesson = playing.value
    stop()
    if (!lesson) {
      return
    }
    await $fetch('/api/profile/lessons', { method: 'POST', body: { lesson } }).catch(() => {})
    await refresh()
  }

  // La dernière bulle passée finit la leçon. Celle du camp n'arrive jamais là :
  // son au revoir attend l'ascension (finish).
  function next(): void {
    if (choices.value) {
      return
    }
    index.value += 1
    if (index.value >= (lines.value?.length ?? 0)) {
      void complete()
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
    watch(() => dueLesson(state.value), (lesson) => {
      const ready = lesson && !lines.value ? LESSON_LINES[lesson]() : null
      if (!ready) {
        return
      }
      play(ready)
      playing.value = lesson
      if (lesson !== 'camp') {
        return
      }
      void fetchItems().then(({ items }) => {
        // `toRaw` : la ref rend un proxy, jamais le tableau joué lui-même.
        if (toRaw(lines.value) === ready && index.value === 0) {
          index.value = lessonStart(ready, items.includes('CHEESE'))
        }
      }, () => {})
    }, { immediate: true })
  }

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
    const replayed = lesson ? LESSON_LINES[lesson]() : null
    stop()
    // ponytail: le rattrapage ne se rejoue qu'avec ses chiffres ; ailleurs,
    // Michel se tait. À revoir quand son sprite rendra le rejeu cliquable
    // (TODO(image), CooldownCamp).
    if (replayed) {
      play(replayedLesson(replayed))
    }
  }

  // Seule la vraie leçon du camp finit sur l'au revoir qui attend l'ascension :
  // rejouée, elle n'attend plus rien. Elle finit comme les autres.
  return { line, choices, next, done, offer, choose, finish: complete }
}
