import type { GameState } from '~~/server/utils/game'

/**
 * Ce que l'accueil propose de faire ensuite, nommé d'après la phase renvoyée par
 * le serveur — un joueur en attente n'a pas à cliquer pour l'apprendre.
 * Voir specs/ecrans.md.
 */
export function mainActionLabel(state: GameState): string {
  switch (state.phase) {
    case 'ascent':
      return state.started ? 'Reprendre l\'ascension' : 'Commencer l\'ascension'
    case 'cooldown':
      return 'Voir l\'attente'
    case 'recovery':
      return 'Aller au rattrapage'
    case 'floorEnd':
      return 'Continuer vers l\'étage suivant'
    case 'gameOver':
      return 'Revoir la fin'
  }
}

/**
 * Ce que propose le bouton de la page de jeu quand aucune question n'est servie :
 * lire la suite d'un rattrapage, franchir un palier, ou reprendre l'ascension.
 * Le libellé suit la phase renvoyée par le serveur ; la page n'en déduit aucune.
 */
export function nextActionLabel(state: GameState): string {
  if (state.phase === 'recovery') {
    if (!state.recovery) {
      return 'Commencer le rattrapage'
    }

    return recoveryLine(state.recovery).result === null
      ? 'Question suivante'
      : 'Terminer le rattrapage'
  }

  // Un verdict lu en pleine ascension : la suite est la question d'après. Sur un
  // palier, c'est l'étage d'après — et le libellé de l'accueil le dit déjà.
  if (state.verdict && state.phase === 'ascent') {
    return 'Question suivante'
  }

  return mainActionLabel(state)
}

/**
 * Ce que la carte de jeu montre pour un état donné. Le verdict et l'annonce de la
 * phase ne s'excluent pas : la question qui a fini l'étage est justement celle
 * dont la réponse reste à lire, et le palier s'affiche par-dessus.
 * Voir specs/ecrans.md#jeu.
 */
export interface GameScreen {
  /** La question servie, avec son décompte — null quand aucune ne tourne. */
  question: GameState['question']
  /** Le verdict à lire, null tant qu'une question tourne. */
  verdict: GameState['verdict']
  /** Où en est le rattrapage, tel qu'il s'affiche. Null hors rattrapage. */
  recovery: RecoveryLine | null
  /** La phase que le serveur a rendue — l'écran l'annonce, il n'en déduit rien. */
  phase: GameState['phase']
  /** Le libellé du bouton qui fait avancer, null quand rien n'avance ici. */
  action: string | null
}

export interface RecoveryLine {
  /** La question en cours, de 1 au total. */
  position: number
  total: number
  successes: number
  /** Le sort du rattrapage, annoncé une fois toutes les questions jouées. */
  result: 'resumed' | 'waiting' | null
}

export function gameScreen(state: GameState): GameScreen {
  const answering = state.question !== null

  return {
    question: state.question,
    verdict: answering ? null : state.verdict,
    recovery: state.recovery && recoveryLine(state.recovery),
    phase: state.phase,
    // Pendant une question, aucune action à part répondre ; à la fin de partie,
    // plus aucune. Voir specs/ecrans.md#principes.
    action: answering || state.phase === 'gameOver' ? null : nextActionLabel(state),
  }
}

/** Le résultat ne s'annonce qu'à la fin, jamais question par question. */
function recoveryLine(recovery: NonNullable<GameState['recovery']>): RecoveryLine {
  const over = recovery.played >= recovery.total

  return {
    position: Math.min(recovery.played + 1, recovery.total),
    total: recovery.total,
    successes: recovery.successes,
    result: over ? (recovery.resumes ? 'resumed' : 'waiting') : null,
  }
}
