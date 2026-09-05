import { describe, expect, it } from 'vitest'
import { gameScreen, mainActionLabel, nextActionLabel } from '../../utils/phase'
import type { GameState } from '../../server/utils/game'

function state(overrides: Partial<GameState>): GameState {
  return {
    phase: 'ascent',
    floor: 1,
    lives: 3,
    started: false,
    question: null,
    verdict: null,
    cooldownUntil: null,
    recovery: null,
    recoveryResult: null,
    floorSeen: 0,
    floorTotal: 0,
    attemptSeen: 0,
    ...overrides,
  }
}

describe('action principale de l accueil', () => {
  it('propose de commencer tant que rien n a été joué', () => {
    expect(mainActionLabel(state({ phase: 'ascent', started: false }))).toBe('Commencer l\'ascension')
  })

  it('propose de reprendre une ascension entamée', () => {
    expect(mainActionLabel(state({ phase: 'ascent', started: true }))).toBe('Reprendre l\'ascension')
  })

  it('annonce ce qui attend le joueur dans les autres phases', () => {
    expect(mainActionLabel(state({ phase: 'cooldown' }))).toBe('Voir l\'attente')
    expect(mainActionLabel(state({ phase: 'recovery' }))).toBe('Aller au rattrapage')
    expect(mainActionLabel(state({ phase: 'floorEnd' }))).toBe('Continuer vers l\'étage suivant')
    expect(mainActionLabel(state({ phase: 'gameOver' }))).toBe('Revoir la fin')
  })
})

const verdict = { questionId: 'q1', correct: false, answerLabel: 'BORDEAUX', submittedAnswer: 'Toulouse', lifeLost: true }

describe('écran de jeu', () => {
  const question = {
    id: 'q1',
    statement: 'Capitale de la Gironde ?',
    expiresAt: '2026-09-03T12:00:20.000Z',
    focusGraceMs: 1_000,
    lootQuestion: false,
  }

  it('ne montre que la question tant qu elle est servie', () => {
    expect(gameScreen(state({ question, verdict }))).toMatchObject({
      question,
      verdict: null,
      phase: 'ascent',
      // Pendant une question, aucune action à part répondre.
      action: null,
    })
  })

  it('montre le verdict et propose la suite', () => {
    expect(gameScreen(state({ verdict }))).toMatchObject({
      question: null,
      verdict,
      phase: 'ascent',
      action: 'Question suivante',
    })
  })

  it('affiche le palier par-dessus le verdict de la dernière question', () => {
    expect(gameScreen(state({ phase: 'floorEnd', verdict }))).toMatchObject({
      verdict,
      phase: 'floorEnd',
      action: 'Continuer vers l\'étage suivant',
    })
  })

  it('affiche la fin de partie par-dessus le verdict, sans plus rien à faire', () => {
    expect(gameScreen(state({ phase: 'gameOver', verdict }))).toMatchObject({
      verdict,
      phase: 'gameOver',
      action: null,
    })
  })

  it('n annonce le sort du rattrapage qu une fois toutes ses questions jouées', () => {
    const recovery = { total: 3, played: 1, successes: 1, resumes: true }

    expect(gameScreen(state({ phase: 'recovery', recovery, verdict })).recovery)
      .toEqual({ position: 2, total: 3, successes: 1, result: null })

    expect(gameScreen(state({ phase: 'recovery', recovery: { ...recovery, played: 3 }, verdict })).recovery)
      .toEqual({ position: 3, total: 3, successes: 1, result: 'resumed' })

    expect(gameScreen(state({
      phase: 'recovery',
      recovery: { ...recovery, played: 3, successes: 0, resumes: false },
      verdict,
    })).recovery?.result).toBe('waiting')
  })
})

describe('action de la page de jeu', () => {
  it('enchaîne sur la question suivante après un verdict d ascension', () => {
    expect(nextActionLabel(state({ phase: 'ascent', verdict }))).toBe('Question suivante')
  })

  it('propose de franchir le palier, verdict de la dernière question compris', () => {
    expect(nextActionLabel(state({ phase: 'floorEnd' }))).toBe('Continuer vers l\'étage suivant')
    expect(nextActionLabel(state({ phase: 'floorEnd', verdict })))
      .toBe('Continuer vers l\'étage suivant')
  })

  it('démarre, poursuit puis termine un rattrapage', () => {
    const recovery = { total: 3, played: 0, successes: 0, resumes: false }

    expect(nextActionLabel(state({ phase: 'recovery' }))).toBe('Commencer le rattrapage')
    expect(nextActionLabel(state({ phase: 'recovery', recovery, verdict })))
      .toBe('Question suivante')
    expect(nextActionLabel(state({ phase: 'recovery', recovery: { ...recovery, played: 3 } })))
      .toBe('Terminer le rattrapage')
  })
})
