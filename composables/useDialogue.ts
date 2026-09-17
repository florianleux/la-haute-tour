import { dialogueGesture, revealedLength } from '../utils/dialogue'
import { withNonBreakingSpaces } from '../utils/typography'
import type { DialogueLine, Speaker } from '../utils/dialogue'
import type { ComputedRef, Ref } from 'vue'

/**
 * Le temps qu'un caractère met à sortir. Écrit ici une fois : un dialogue qui
 * emporterait sa vitesse en prop finirait par en avoir une par appelant, et
 * deux scènes du même jeu ne se liraient plus au même rythme.
 */
const REVEAL_MS = 30

export interface DialoguePlayback {
  /** Qui parle à cet instant. */
  speaker: ComputedRef<Speaker>
  /** Ce qui est sorti de sa réplique. */
  shown: ComputedRef<string>
  /** Elle est sortie en entier : le geste suivant passe à la suite. */
  revealed: ComputedRef<boolean>
  /** Le geste du joueur : révéler, passer, ou rendre la main. */
  advance: () => void
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
export function useDialogue(lines: Ref<DialogueLine[]>, onEnd: () => void): DialoguePlayback {
  const index = ref(0)
  const elapsed = ref(0)

  const speaker = computed(() => lines.value[index.value].speaker)

  // La ponctuation est corrigée avant le découpage, jamais après : appliquée à
  // un texte déjà tronqué, l'espace insécable manquerait le « ? » qui n'est pas
  // encore sorti, et la longueur à révéler changerait en cours de défilé.
  const text = computed(() => withNonBreakingSpaces(lines.value[index.value].text))
  const shown = computed(() => text.value.slice(
    0,
    revealedLength(elapsed.value, REVEAL_MS, text.value.length),
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
    elapsed.value = text.value.length * REVEAL_MS
  }

  function playLine(): void {
    stop()
    elapsed.value = 0

    // Le défilé est une animation : qui les refuse lit la réplique entière tout
    // de suite plutôt que de la voir ramper.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      revealAll()
      return
    }

    const startedAt = Date.now()

    timer = setInterval(() => {
      elapsed.value = Date.now() - startedAt

      if (revealed.value) {
        stop()
      }
    }, REVEAL_MS)
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

  return { speaker, shown, revealed, advance }
}
