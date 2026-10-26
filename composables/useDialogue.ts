import { dialogueGesture, dialogueLineup, promptAnswered, speakerAt } from '../utils/dialogue'
import { REVEAL_MS, useTextReveal } from './useTextReveal'
import { withNonBreakingSpaces } from '../utils/typography'
import type { Dialogue, DialogueChoices, DialogueGesture, DialoguePrompt, LineupMember, Speaker, SpeakerPlace } from '../utils/dialogue'
import type { ComputedRef, Ref } from 'vue'

export interface DialogueOptions {
  /** La dernière réplique est passée : l'écran appelant reprend la main. */
  onEnd: () => void
  /**
   * Une invite vient d'être satisfaite : voici ce que le joueur a écrit, espaces
   * de bout coupés. Le dialogue ne garde rien — c'est l'écran appelant qui en
   * fait quelque chose, comme il décide déjà de la suite à `onEnd`.
   */
  onAnswer?: (answer: string) => void
  /**
   * Un choix vient d'être cliqué : voici son rang, de 0 au nombre de choix moins
   * un. Le rang et non le texte : c'est l'écran appelant qui sait ce que chaque
   * réponse veut dire, et il les a écrites dans cet ordre.
   */
  onChoose?: (rank: number) => void
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
  lineup: ComputedRef<LineupMember[]>
  /** Qui parle à cet instant, et d'où. */
  speaker: ComputedRef<Speaker>
  place: ComputedRef<SpeakerPlace>
  /** Ce qui est sorti de sa réplique. */
  shown: ComputedRef<string>
  /** Elle est sortie en entier : le geste suivant passe à la suite. */
  revealed: ComputedRef<boolean>
  /** Ce que la réplique en cours demande d'écrire, s'il y a lieu. */
  prompt: ComputedRef<DialoguePrompt | null>
  /** Ce que le joueur écrit dans l'invite en cours. */
  answer: Ref<string>
  /** Les réponses que la réplique en cours propose, s'il y a lieu. */
  choices: ComputedRef<DialogueChoices | null>
  /**
   * L'invite attend encore une saisie valable, ou les choix un clic : le geste
   * ne passe pas.
   */
  awaiting: ComputedRef<boolean>
  /** Le geste du joueur : révéler, passer, ou rendre la main. */
  advance: () => void
  /** Le joueur clique le choix de ce rang : le dialogue passe à la suite. */
  choose: (rank: number) => void
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
  const lineup = computed(() => dialogueLineup(dialogue.value))
  const line = computed(() => dialogue.value.lines[index.value])
  const place = computed(() => line.value.place)
  const speaker = computed(() => speakerAt(dialogue.value, place.value))
  const revealMs = computed(() => dialogue.value.revealMs ?? REVEAL_MS)

  // La ponctuation est corrigée avant le découpage, jamais après : appliquée à
  // un texte déjà tronqué, l'espace insécable manquerait le « ? » qui n'est pas
  // encore sorti, et la longueur à révéler changerait en cours de défilé.
  const text = computed(() => withNonBreakingSpaces(line.value.text))
  const { shown, revealed, restart, revealAll, stop } = useTextReveal(text, revealMs, options.now)

  /**
   * L'invite de la réplique en cours et ce que le joueur y écrit. La saisie se
   * vide en passant à la suivante : c'est une réponse à cette question-là, pas
   * un état du dialogue.
   */
  const prompt = computed(() => line.value.prompt ?? null)
  const answer = ref('')
  const choices = computed(() => line.value.choices ?? null)
  const awaiting = computed(() => {
    const asked = prompt.value

    // Des choix attendent toujours un clic sur l'un d'eux. Seule exception, au
    // clavier : un choix seul se prend à Entrée ou aux flèches (dialogueGesture).
    return choices.value !== null || (asked !== null && !promptAnswered(asked, answer.value))
  })

  /** La réplique en cours, depuis le début : son défilé repart, sa saisie se vide. */
  function playLine(): void {
    answer.value = ''
    restart()
  }

  function advance(): void {
    const progress = {
      index: index.value,
      revealed: revealed.value,
      awaiting: awaiting.value,
      choiceCount: choices.value?.length,
    }
    const gesture = dialogueGesture(progress, dialogue.value.lines.length)

    // La saisie est rendue avant que la réplique change : après, l'invite n'est
    // plus celle à laquelle le joueur vient de répondre.
    if (prompt.value && (gesture === 'next' || gesture === 'end')) {
      options.onAnswer?.(answer.value.trim())
    }

    perform(gesture)
  }

  function choose(rank: number): void {
    // Rien à cliquer avant que la question soit entièrement posée : les choix ne
    // sont pas encore affichés.
    if (!choices.value || !revealed.value) {
      return
    }

    // Même ordre que la saisie : le rang part avant que la réplique change.
    options.onChoose?.(rank)
    // Le clic a répondu : ce qui suit est ce qu'un geste ferait d'une réplique
    // sortie et qui n'attend plus rien.
    perform(dialogueGesture(
      { index: index.value, revealed: true, awaiting: false },
      dialogue.value.lines.length,
    ))
  }

  function perform(gesture: DialogueGesture): void {
    switch (gesture) {
      case 'wait':
        break
      case 'choose':
        choose(0)
        break
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

  return { lineup, speaker, place, shown, revealed, prompt, answer, choices, awaiting, advance, choose }
}
