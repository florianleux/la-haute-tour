import { dialogueCast, dialogueGesture, revealedLength } from '../utils/dialogue'
import { withNonBreakingSpaces } from '../utils/typography'
import type { CastMember, Dialogue, DialogueLine, Speaker, SpeakerPlace } from '../utils/dialogue'
import type { ComputedRef, Ref } from 'vue'

/**
 * Le rythme du jeu : le temps qu'un caractère met à sortir quand la scène n'en
 * demande pas un autre. Écrit ici une fois, comme TICK_MS dans useClockTick :
 * une scène qui veut ralentir le dit (`revealMs`), les autres suivent ce
 * rythme-là sans avoir à le recopier.
 */
const REVEAL_MS = 30

export interface DialogueOptions {
  /** La dernière réplique est passée : l'écran appelant reprend la main. */
  onEnd: () => void
  /**
   * L'horloge, quand l'appelant la tient — un test. Fournie, le défilé n'a plus
   * de minuterie à lui : il lit l'heure qu'on lui donne. Même couture que
   * useQuestionRun, pour la même raison : le temps qui passe se pilote mieux
   * qu'il ne se simule.
   */
  now?: Ref<number>
}

export interface DialoguePlayback {
  /** Les portraits à poser, et où. */
  cast: ComputedRef<CastMember[]>
  /** Qui parle à cet instant, et d'où. */
  speaker: ComputedRef<Speaker>
  place: ComputedRef<SpeakerPlace>
  /** Ce qui est sorti de sa réplique. */
  shown: ComputedRef<string>
  /** Elle est sortie en entier : le geste suivant passe à la suite. */
  revealed: ComputedRef<boolean>
  /** Le geste du joueur : révéler, passer, ou rendre la main. */
  advance: () => void
}

/**
 * Qui se tient à cette place. Il y a toujours quelqu'un : une réplique ne peut
 * pas nommer une place que son dialogue ne remplit pas, la forme du type
 * l'interdit (voir ADR 0010). C'est ce qui permet de rendre un `Speaker` et non
 * un `Speaker | undefined`, sans garde ni cast.
 */
function speakerAt(dialogue: Dialogue, place: SpeakerPlace): Speaker {
  if (dialogue.center) {
    return dialogue.center
  }

  return place === 'left' ? dialogue.left : dialogue.right
}

/**
 * Le déroulé d'un dialogue : la réplique en cours, son défilé, et le geste qui
 * fait avancer les deux. Voir specs/spec.md (glossaire).
 *
 * Il se dérive du dialogue qu'on lui passe, pas de l'instant du montage : en
 * servir un autre le reprend à sa première réplique. Sans ça, l'appelant devait
 * remonter la scène par un `:key`, et lui en servir un plus court laissait le
 * compteur hors bornes.
 */
export function useDialogue(dialogue: Ref<Dialogue>, options: DialogueOptions): DialoguePlayback {
  const index = ref(0)
  const cast = computed(() => dialogueCast(dialogue.value))
  const lines = computed<DialogueLine[]>(() => dialogue.value.lines)
  const line = computed(() => lines.value[index.value])
  const place = computed(() => line.value.place)
  const speaker = computed(() => speakerAt(dialogue.value, place.value))
  const revealMs = computed(() => dialogue.value.revealMs ?? REVEAL_MS)

  /**
   * L'horloge du défilé : celle de l'appelant s'il en tient une, sinon la
   * sienne, que la minuterie ci-dessous avance. Elle sert à faire recalculer ce
   * qui est sorti, jamais à dater le départ d'une réplique — elle est figée dès
   * que la minuterie s'arrête, donc en retard sur l'heure vraie.
   */
  const clock = options.now ?? ref(Date.now())
  const startedAt = ref(clock.value)
  /** Un geste a tout révélé d'un coup : le temps ne décide plus de cette réplique. */
  const forced = ref(false)

  // La ponctuation est corrigée avant le découpage, jamais après : appliquée à
  // un texte déjà tronqué, l'espace insécable manquerait le « ? » qui n'est pas
  // encore sorti, et la longueur à révéler changerait en cours de défilé.
  const text = computed(() => withNonBreakingSpaces(line.value.text))
  const count = computed(() => (forced.value
    ? text.value.length
    : revealedLength(clock.value - startedAt.value, revealMs.value, text.value.length)))

  const shown = computed(() => text.value.slice(0, count.value))
  const revealed = computed(() => count.value === text.value.length)

  let timer: ReturnType<typeof setInterval> | null = null

  function stop(): void {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
  }

  /** L'heure vraie : l'horloge du test si elle existe, celle du monde sinon. */
  function readClock(): number {
    return options.now?.value ?? Date.now()
  }

  function revealAll(): void {
    stop()
    forced.value = true
  }

  /**
   * Le défilé de la réplique en cours. La minuterie ne tourne que dans un
   * navigateur, et seulement quand personne d'autre ne tient l'horloge — même
   * garde que useQuestionRun.
   *
   * Rien n'attend le montage : à l'hydratation, rien n'est encore sorti et la
   * boîte rend le vide, exactement comme le rendu serveur. Les deux côtés
   * partent donc du même premier état.
   */
  function playLine(): void {
    stop()
    forced.value = false
    // L'heure vraie, pas `clock.value` : celle-ci est restée sur le dernier
    // battement d'avant l'arrêt de la minuterie, et le temps passé à lire la
    // réplique précédente aurait été compté comme du défilé déjà écoulé.
    startedAt.value = readClock()
    clock.value = startedAt.value

    if (options.now || !import.meta.client) {
      return
    }

    timer = setInterval(() => {
      clock.value = Date.now()

      if (revealed.value) {
        stop()
      }
    }, revealMs.value)
  }

  function advance(): void {
    switch (dialogueGesture({ index: index.value, revealed: revealed.value }, lines.value.length)) {
      case 'reveal':
        revealAll()
        break
      case 'next':
        index.value += 1
        playLine()
        break
      case 'end':
        stop()
        options.onEnd()
        break
    }
  }

  playLine()
  // Un autre dialogue le reprend au début : le déroulé suit son entrée plutôt
  // que l'instant où il a été monté.
  watch(dialogue, () => {
    index.value = 0
    playLine()
  })
  onScopeDispose(stop)

  return { cast, speaker, place, shown, revealed, advance }
}
