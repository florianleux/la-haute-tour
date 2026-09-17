import { dialogueGesture, revealedLength } from '../utils/dialogue'
import { withNonBreakingSpaces } from '../utils/typography'
import type { Dialogue, DialogueLine, Speaker, SpeakerPlace } from '../utils/dialogue'
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
 * Il ne se rembobine pas : un dialogue commence là où le composant se monte, et
 * en jouer un autre veut dire remonter la scène (`:key`). Un compteur remis à
 * zéro en douce laisserait le défilé de l'ancienne réplique courir sur la
 * nouvelle.
 */
export function useDialogue(dialogue: Ref<Dialogue>, options: DialogueOptions): DialoguePlayback {
  const index = ref(0)
  const lines = computed<DialogueLine[]>(() => dialogue.value.lines)
  const place = computed(() => lines.value[index.value].place)
  const speaker = computed(() => speakerAt(dialogue.value, place.value))
  const revealMs = computed(() => dialogue.value.revealMs ?? REVEAL_MS)

  // L'horloge du défilé. Celle de l'appelant s'il en tient une, sinon la sienne,
  // que la minuterie ci-dessous avance.
  const clock = options.now ?? ref(Date.now())
  const startedAt = ref(clock.value)
  /**
   * Le temps réputé écoulé quand un geste a révélé la réplique d'un coup. Il
   * gèle le défilé sans toucher à l'horloge, qui n'appartient pas forcément à ce
   * composable.
   */
  const forced = ref<number | null>(null)

  const elapsed = computed(() => forced.value ?? clock.value - startedAt.value)

  // La ponctuation est corrigée avant le découpage, jamais après : appliquée à
  // un texte déjà tronqué, l'espace insécable manquerait le « ? » qui n'est pas
  // encore sorti, et la longueur à révéler changerait en cours de défilé.
  const text = computed(() => withNonBreakingSpaces(lines.value[index.value].text))
  const shown = computed(() => text.value.slice(
    0,
    revealedLength(elapsed.value, revealMs.value, text.value.length),
  ))
  const revealed = computed(() => shown.value.length === text.value.length)

  let timer: ReturnType<typeof setInterval> | null = null

  function stop(): void {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
  }

  function revealAll(): void {
    stop()
    forced.value = text.value.length * revealMs.value
  }

  /**
   * Le défilé de la réplique en cours. La minuterie ne tourne que dans un
   * navigateur, et seulement quand personne d'autre ne tient l'horloge — même
   * garde que useQuestionRun.
   *
   * Rien n'attend le montage : à l'hydratation, `elapsed` vaut encore zéro et la
   * boîte sort vide, exactement comme le rendu serveur. Les deux côtés partent
   * donc du même premier état.
   */
  function playLine(): void {
    stop()
    forced.value = null
    startedAt.value = clock.value

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
  onScopeDispose(stop)

  return { speaker, place, shown, revealed, advance }
}
