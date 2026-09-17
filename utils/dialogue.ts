/**
 * Un dialogue, dit sans DOM pour rester testable : la forme qu'il peut prendre,
 * ce qu'un geste du joueur y fait, et ce qui est sorti d'une réplique. Voir le
 * glossaire de specs/spec.md.
 */

/**
 * Où un interlocuteur se tient sur la scène. Ce n'est pas un côté : seul, il se
 * place au milieu.
 */
export type SpeakerPlace = 'left' | 'right' | 'center'

export interface Speaker {
  /** Le nom écrit au-dessus de la réplique. */
  name: string
  /**
   * Le portrait, servi tel quel — chemin public ou data URI. Il n'entre pas dans
   * une classe Tailwind : celles-ci ne sont générées que depuis les littéraux du
   * source, et l'image d'un interlocuteur est une donnée.
   */
  portrait: string
}

/** Une prise de parole : d'où elle vient, et ce qui s'y dit. */
export interface DialogueLine<P extends SpeakerPlace = SpeakerPlace> {
  place: P
  text: string
}

/** Ce que les deux formes de dialogue ont en commun. */
interface DialogueStage {
  /** Le décor derrière la scène, de même nature que `Speaker.portrait`. */
  background: string
  /**
   * Le temps qu'un caractère met à sortir. Absent, le dialogue va au rythme du
   * jeu (voir `useDialogue`) — c'est le cas courant, et le redéclarer partout
   * ferait diverger des scènes que rien ne distingue.
   */
  revealMs?: number
}

/**
 * Un dialogue : deux interlocuteurs de part et d'autre, ou un seul au milieu.
 *
 * L'affiche est **déclarée, jamais déduite des répliques** : un personnage qui
 * apparaîtrait au moment de parler pour disparaître ensuite ferait clignoter la
 * scène, et une affiche devinée écartait en silence un troisième venu.
 *
 * Les `?: never` tiennent cet interdit, et ils ne sont pas décoratifs : le
 * contrôle des propriétés en trop est permissif sur une union — TypeScript
 * accepte une propriété dès qu'elle existe dans n'importe lequel des membres.
 * Sans eux, `{ left, right, center }` compile et le troisième portrait ne
 * s'affiche jamais. Voir ADR 0010.
 *
 * Un dialogue porte au moins une réplique : il n'a rien à jouer sinon.
 */
export type Dialogue = DialogueStage & (
  | { left: Speaker, right: Speaker, center?: never, lines: DialogueLine<'left' | 'right'>[] }
  | { center: Speaker, left?: never, right?: never, lines: DialogueLine<'center'>[] }
)

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
