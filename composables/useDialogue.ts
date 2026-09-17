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
export function useDialogue(dialogue: Ref<Dialogue>, onEnd: () => void): DialoguePlayback {
  const index = ref(0)
  const elapsed = ref(0)

  const lines = computed<DialogueLine[]>(() => dialogue.value.lines)
  const place = computed(() => lines.value[index.value].place)
  const speaker = computed(() => speakerAt(dialogue.value, place.value))
  const revealMs = computed(() => dialogue.value.revealMs ?? REVEAL_MS)

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
    elapsed.value = text.value.length * revealMs.value
  }

  function playLine(): void {
    stop()
    elapsed.value = 0

    const startedAt = Date.now()

    timer = setInterval(() => {
      elapsed.value = Date.now() - startedAt

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
        onEnd()
        break
    }
  }

  // Le défilé ne part qu'au montage : rendue côté serveur, la boîte sort vide et
  // se remplit une fois hydratée. Les deux côtés partent donc du même premier
  // état, là où un texte déjà écrit côté serveur ne correspondrait plus à ce que
  // le client rend à l'hydratation.
  onMounted(playLine)
  onScopeDispose(stop)

  return { speaker, place, shown, revealed, advance }
}
