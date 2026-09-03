import type { GameState } from '~~/server/utils/game'

/**
 * What the accueil offers to do next, named after the phase the server returned —
 * a player waiting shouldn't have to click to find out. See specs/ecrans.md.
 */
/**
 * What the game page says for a phase it doesn't render in full yet. Each of these
 * screens lands with its own ticket; this keeps the page honest until then.
 */
export function phaseMessage(phase: GameState['phase']): string {
  switch (phase) {
    case 'cooldown':
      return 'Tu as perdu ta dernière vie. Reviens plus tard.'
    case 'recovery':
      return 'Ton rattrapage t\'attend.'
    case 'floorEnd':
      return 'Étage terminé.'
    case 'gameOver':
      return 'Tu as fini La Haute Tour.'
    case 'ascent':
      return ''
  }
}

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
