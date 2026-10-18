import { dialogueGesture, dialogueLineup, promptAnswered, revealedLength, speakerAt } from '../utils/dialogue'
import { withNonBreakingSpaces } from '../utils/typography'
import type { Dialogue, DialogueChoices, DialogueGesture, DialoguePrompt, LineupMember, Speaker, SpeakerPlace } from '../utils/dialogue'
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

  /**
   * L'horloge du défilé : celle de l'appelant s'il en tient une, sinon la
   * sienne, que la minuterie ci-dessous avance. On ne lui écrit jamais — celle
   * de l'appelant est à lui, et un composable qui avance l'horloge qu'on lui
   * prête n'est une surprise que le jour où ça compte. Elle sert à faire
   * recalculer ce qui est sorti, jamais à dater le départ d'une réplique : elle
   * est figée dès que la minuterie s'arrête, donc en retard sur l'heure vraie.
   */
  const ticks = ref(Date.now())
  const clock = computed(() => options.now?.value ?? ticks.value)
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
    answer.value = ''
    // L'heure vraie, pas `clock.value` : celle-ci est restée sur le dernier
    // battement d'avant l'arrêt de la minuterie, et le temps passé à lire la
    // réplique précédente aurait été compté comme du défilé déjà écoulé.
    startedAt.value = readClock()

    if (options.now || !import.meta.client) {
      return
    }

    timer = setInterval(() => {
      ticks.value = Date.now()

      if (revealed.value) {
        stop()
      }
    }, revealMs.value)
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
  onScopeDispose(stop)

  return { lineup, speaker, place, shown, revealed, prompt, answer, choices, awaiting, advance, choose }
}
