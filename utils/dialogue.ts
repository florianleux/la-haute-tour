/**
 * Un dialogue, dit sans DOM pour rester testable : qui tient l'affiche, ce qu'il
 * reste à révéler d'une réplique, et ce qu'un geste du joueur y fait. Voir le
 * glossaire de specs/spec.md.
 */

/** De quel côté de la scène un interlocuteur se tient. */
export type SpeakerSide = 'left' | 'right'

export interface Speaker {
  /** Le nom écrit au-dessus de la réplique. */
  name: string
  /**
   * Le portrait, servi tel quel — chemin public ou data URI. Il n'entre pas
   * dans une classe Tailwind : celles-ci ne sont générées que depuis les
   * littéraux du source, et l'image d'un interlocuteur est une donnée.
   */
  portrait: string
  side: SpeakerSide
}

export interface DialogueLine {
  speaker: Speaker
  text: string
}

export interface Dialogue {
  /** Le décor derrière la scène, de même nature que `Speaker.portrait`. */
  background: string
  /** Au moins une réplique : un dialogue sans texte n'a rien à jouer. */
  lines: DialogueLine[]
}

/** Les portraits à l'affiche, un par côté — indépendants de la réplique en cours. */
export interface Stage {
  left: Speaker | null
  right: Speaker | null
}

/**
 * Qui tient l'affiche. Les portraits se posent une fois pour tout le dialogue et
 * ne bougent plus : un personnage qui apparaîtrait au moment de parler pour
 * disparaître ensuite ferait clignoter la scène à chaque réplique. C'est le
 * retrait du portrait, pas son absence, qui dit que ce n'est pas son tour.
 *
 * Un seul interlocuteur par côté, le premier rencontré le tient. Deux
 * personnages du même côté ne peuvent pas être à l'affiche ensemble, et l'ordre
 * des répliques est le seul critère disponible pour trancher.
 */
export function dialogueStage(lines: DialogueLine[]): Stage {
  const stage: Stage = { left: null, right: null }

  for (const { speaker } of lines) {
    if (!stage[speaker.side]) {
      stage[speaker.side] = speaker
    }
  }

  return stage
}

/** Où en est un dialogue au moment où le joueur fait son geste. */
export interface DialogueProgress {
  /** La réplique en cours, de 0 à `total - 1`. */
  index: number
  /** Son texte est entièrement sorti. */
  revealed: boolean
}

/** Ce qu'un geste — clic, tape ou Entrée — fait d'un dialogue. */
export type DialogueGesture = 'reveal' | 'next' | 'end'

/**
 * Un geste pendant le défilé affiche la réplique en entier ; le suivant passe à
 * la suivante ; celui qui suit la dernière rend la main à l'écran qui a lancé le
 * dialogue. Le joueur pressé n'attend donc jamais le défilé, et celui qui lit
 * n'a rien de plus à apprendre — c'est le même geste du début à la fin.
 */
export function dialogueGesture(
  { index, revealed }: DialogueProgress,
  total: number,
): DialogueGesture {
  if (!revealed) {
    return 'reveal'
  }

  return index + 1 < total ? 'next' : 'end'
}

/**
 * Combien de caractères sont sortis après `elapsedMs`. Déduit du temps écoulé
 * plutôt qu'incrémenté à chaque battement : un onglet passé en arrière-plan, où
 * le navigateur espace les minuteries, rattrape alors son retard d'un coup au
 * lieu de rendre sa réplique deux fois plus lente que les autres.
 */
export function revealedLength(elapsedMs: number, msPerChar: number, total: number): number {
  return Math.max(0, Math.min(total, Math.floor(elapsedMs / msPerChar)))
}
