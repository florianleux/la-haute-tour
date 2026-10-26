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

/**
 * La couleur des répliques d'un interlocuteur, reprise de son habit. Un nom de
 * couleur et non une classe : le composant la traduit, Tailwind ne générant
 * que les classes écrites en entier dans le source.
 */
export type SpeakerColor = 'orange' | 'brown'

export interface Speaker {
  /** Le nom écrit au-dessus de la réplique. */
  name: string
  /**
   * Le portrait, servi tel quel — chemin public ou data URI. Il n'entre pas dans
   * une classe Tailwind : celles-ci ne sont générées que depuis les littéraux du
   * source, et l'image d'un interlocuteur est une donnée.
   */
  portrait: string
  /**
   * À `false`, le portrait ne passe jamais en retrait : il garde l'allure de
   * celui qui parle, même quand ce n'est pas son tour. Pour un portrait déjà
   * délavé, que le retrait rendrait illisible. Voir specs/spec.md (« Retrait »).
   */
  retreats?: false
  /** Absente, ses répliques gardent la couleur du texte de la boîte. */
  color?: SpeakerColor
}

/**
 * Ce qu'une réplique demande à écrire au joueur. Voir le glossaire de
 * specs/spec.md (« Invite »).
 */
export interface DialoguePrompt {
  /** Le libellé du champ : « Ton nom ». */
  label: string
  /**
   * Les bornes de ce qui est accepté, espaces de bout coupés. En dessous du
   * minimum, le dialogue n'avance pas ; au-dessus du maximum, le champ ne
   * laisse plus écrire.
   */
  minLength: number
  maxLength: number
}

/**
 * Les réponses qu'une réplique propose, dans l'ordre où elles s'affichent. Au
 * moins une : sans elle, la réplique attendrait un clic qui ne peut pas venir.
 * Voir le glossaire de specs/spec.md (« Choix »).
 */
export type DialogueChoices = readonly [string, ...string[]]

/** Un geste proposé par une fenêtre de dialogue (BaseDialogueWindow) : son libellé et ce qu'il fait. */
export interface DialogueAction {
  label: string
  run: () => void
}

/**
 * Une prise de parole : d'où elle vient, ce qui s'y dit, ce qu'elle demande.
 *
 * Une invite ou des choix, jamais les deux : la réplique n'attendrait alors
 * qu'une des deux réponses, et l'autre s'afficherait pour rien. Les `?: never`
 * le tiennent, comme sur `Dialogue`.
 */
export type DialogueLine<P extends SpeakerPlace = SpeakerPlace> = { place: P, text: string } & (
  | {
    /** Présente, la réplique attend une saisie avant de laisser passer. */
    prompt?: DialoguePrompt
    choices?: never
  }
  | {
    /** Présents, la réplique attend que le joueur en clique un. */
    choices: DialogueChoices
    prompt?: never
  }
)

/**
 * Les répliques d'un dialogue : au moins une, dite par le type plutôt que par un
 * commentaire. Un tableau ordinaire laissait passer `lines: []`, que rien
 * n'arrêtait ensuite — `noUncheckedIndexedAccess` est à `false`, si bien que la
 * première réplique se lisait comme si elle existait et le montage plantait.
 */
type Lines<P extends SpeakerPlace> = [DialogueLine<P>, ...DialogueLine<P>[]]

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
 * Un dialogue porte au moins une réplique : il n'a rien à jouer sinon, et
 * `Lines` le lui impose.
 */
export type Dialogue = DialogueStage & (
  | { left: Speaker, right: Speaker, center?: never, lines: Lines<'left' | 'right'> }
  | { center: Speaker, left?: never, right?: never, lines: Lines<'center'> }
)

/** Un interlocuteur à l'affiche, et la place qu'il y tient. */
export interface LineupMember {
  speaker: Speaker
  place: SpeakerPlace
}

/**
 * Qui est à l'affiche, dans l'ordre où la scène les pose. Écrit ici plutôt que
 * dans le composant : c'est une lecture du dialogue, pas une affaire de rendu,
 * et elle se teste alors sans DOM comme le reste des décisions du module.
 *
 * Les portraits ne bougent plus de tout le dialogue — c'est le retrait, pas
 * l'absence, qui dit que ce n'est pas le tour de quelqu'un.
 */
export function dialogueLineup(dialogue: Dialogue): LineupMember[] {
  if (dialogue.center) {
    return [{ speaker: dialogue.center, place: 'center' }]
  }

  return [
    { speaker: dialogue.left, place: 'left' },
    { speaker: dialogue.right, place: 'right' },
  ]
}

/**
 * Qui se tient à cette place. Il y a toujours quelqu'un : une réplique ne peut
 * pas nommer une place que son dialogue ne remplit pas, la forme du type
 * l'interdit (voir ADR 0010). C'est ce qui permet de rendre un `Speaker` et non
 * un `Speaker | undefined`, sans garde ni assertion.
 *
 * Non déduit de `dialogueLineup` : y chercher une place rendrait un
 * `LineupMember | undefined`, et il faudrait affirmer à TypeScript ce que la
 * forme garantit déjà. La lire directement ne ment à personne.
 */
export function speakerAt(dialogue: Dialogue, place: SpeakerPlace): Speaker {
  return dialogue.center ?? (place === 'left' ? dialogue.left : dialogue.right)
}

/** Où en est un dialogue au moment où le joueur fait son geste. */
export interface DialogueProgress {
  /** La réplique en cours, de 0 à `total - 1`. */
  index: number
  /** Son texte est entièrement sorti. */
  revealed: boolean
  /** Son invite attend encore une saisie valable, ou ses choix un clic. */
  awaiting: boolean
  /** Combien de choix elle propose ; absent quand elle n'en propose pas. */
  choiceCount?: number
}

/** Ce qu'un geste — clic, tape, Entrée ou flèche bas/droite — fait d'un dialogue. */
export type DialogueGesture = 'reveal' | 'next' | 'end' | 'wait' | 'choose'

/**
 * Un geste pendant le défilé affiche la réplique en entier ; le suivant passe à
 * la suivante ; celui qui suit la dernière rend la main à l'écran qui a lancé le
 * dialogue. Le joueur pressé n'attend donc jamais le défilé, et celui qui lit
 * n'a rien de plus à apprendre — c'est le même geste du début à la fin.
 *
 * Une invite l'arrête (`wait`) tant que sa saisie n'est pas valable, des choix
 * tant qu'aucun n'est cliqué : ce sont les seuls moments où le geste ne fait
 * rien, et ils viennent après le défilé — révéler la réplique reste possible,
 * c'est passer outre la question qui ne l'est pas.
 *
 * Un choix seul n'en est pas un : Entrée ou une flèche le prend (`choose`),
 * comme elle passerait une réplique ordinaire. Entre plusieurs, rien ne choisit
 * à la place du joueur.
 */
export function dialogueGesture(
  { index, revealed, awaiting, choiceCount }: DialogueProgress,
  total: number,
): DialogueGesture {
  if (!revealed) {
    return 'reveal'
  }

  if (awaiting) {
    return choiceCount === 1 ? 'choose' : 'wait'
  }

  return index + 1 < total ? 'next' : 'end'
}

/**
 * La saisie entre dans les bornes de l'invite. Les espaces de bout ne comptent
 * pas : «   » n'est pas un nom, et la valeur rendue à l'appelant est celle-ci,
 * coupée.
 */
export function promptAnswered(prompt: DialoguePrompt, answer: string): boolean {
  const { length } = answer.trim()

  return length >= prompt.minLength && length <= prompt.maxLength
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
