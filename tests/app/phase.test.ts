import { describe, expect, it } from 'vitest'
import { blockedByMaintenance, gameScreen, isAnswering, nextActionLabel } from '../../utils/phase'
import type { GameState } from '../../server/utils/game'

function state(overrides: Partial<GameState>): GameState {
  return {
    phase: 'ascent',
    floor: 1,
    lives: 3,
    maxLives: 3,
    started: false,
    question: null,
    verdict: null,
    cooldownUntil: null,
    recovery: null,
    recoveryResult: null,
    floorSeen: 0,
    floorTotal: 0,
    attemptSeen: 0,
    chest: null,
  maintenance: false,
  effects: [],
  unlocked: [],
    ...overrides,
  }
}

describe('entrée dans la partie', () => {
  it('propose de commencer tant que rien n a été joué', () => {
    expect(nextActionLabel(state({ phase: 'ascent', started: false }))).toBe('Commencer l\'ascension')
  })

  it('propose de reprendre une ascension entamée', () => {
    expect(nextActionLabel(state({ phase: 'ascent', started: true }))).toBe('Reprendre l\'ascension')
  })
})

const verdict = { questionId: 'q1', statement: 'Capitale ?', correct: false, answerLabel: 'BORDEAUX', submittedAnswer: 'Toulouse', lifeLost: true }

const question = {
  id: 'q1',
  statement: 'Capitale de la Gironde ?',
  expiresAt: '2026-09-03T12:00:20.000Z',
  focusGraceMs: 1_000,
  lootQuestion: false,
}

describe('écran de jeu', () => {
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
      action: 'Suivant',
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

  it('annonce le sort du rattrapage dès que le verdict est scellé', () => {
    const ongoing = { total: 3, played: 1, successes: 0, resumes: false, sealed: false, lengthened: false }

    expect(gameScreen(state({ phase: 'recovery', recovery: ongoing, verdict })).recovery)
      .toEqual({ position: 2, total: 3, successes: 0, lengthened: false, result: null })

    const resumed = { total: 3, played: 1, successes: 1, resumes: true, sealed: true, lengthened: false }

    expect(gameScreen(state({ phase: 'recovery', recovery: resumed, verdict })).recovery)
      .toEqual({ position: 2, total: 3, successes: 1, lengthened: false, result: 'resumed' })

    const failed = { total: 3, played: 3, successes: 0, resumes: false, sealed: true, lengthened: false }

    expect(gameScreen(state({ phase: 'recovery', recovery: failed, verdict })).recovery?.result)
      .toBe('waiting')
  })
})

describe('action de la page de jeu', () => {
  it('enchaîne sur la question suivante après un verdict d ascension', () => {
    expect(nextActionLabel(state({ phase: 'ascent', verdict }))).toBe('Suivant')
  })

  it('propose de franchir le palier, verdict de la dernière question compris', () => {
    expect(nextActionLabel(state({ phase: 'floorEnd' }))).toBe('Continuer vers l\'étage suivant')
    expect(nextActionLabel(state({ phase: 'floorEnd', verdict })))
      .toBe('Continuer vers l\'étage suivant')
  })

  it('démarre, poursuit puis termine un rattrapage', () => {
    const ongoing = { total: 3, played: 0, successes: 0, resumes: false, sealed: false, lengthened: false }

    expect(nextActionLabel(state({ phase: 'recovery' }))).toBe('Commencer le rattrapage')
    expect(nextActionLabel(state({ phase: 'recovery', recovery: ongoing, verdict })))
      .toBe('Suivant')

    const resumed = { total: 3, played: 1, successes: 1, resumes: true, sealed: true, lengthened: false }
    expect(nextActionLabel(state({ phase: 'recovery', recovery: resumed, verdict })))
      .toBe('Reprendre')

    const failed = { total: 3, played: 3, successes: 0, resumes: false, sealed: true, lengthened: false }
    expect(nextActionLabel(state({ phase: 'recovery', recovery: failed, verdict })))
      .toBe('Terminer le rattrapage')
  })
})

describe('coffre sur l écran de verdict', () => {
  const closed = { opened: false, mimic: false, spell: null }

  it('retient le joueur tant que le coffre est fermé', () => {
    expect(gameScreen(state({ verdict, chest: closed }))).toMatchObject({
      verdict,
      chest: closed,
      // Ouvrir est un clic distinct de « suivant » : rien d'autre n'avance.
      action: null,
    })
  })

  it('rend la suite une fois le coffre ouvert', () => {
    const opened = { opened: true, mimic: false, spell: 'VITALITY' as const }

    expect(gameScreen(state({ verdict, chest: opened }))).toMatchObject({
      chest: opened,
      action: 'Suivant',
    })
  })

  it('cache le coffre tant qu une question est servie', () => {
    expect(gameScreen(state({ question, verdict, chest: closed }))).toMatchObject({
      chest: null,
      action: null,
    })
  })
})

describe('phases qui portent leurs propres actions', () => {
  it('ne propose rien en attente : l écran a ses boutons, et rien n avance', () => {
    expect(gameScreen(state({ phase: 'cooldown', started: true })).action).toBeNull()
  })

  it('ne propose rien à la fin de partie', () => {
    expect(gameScreen(state({ phase: 'gameOver', verdict })).action).toBeNull()
  })
})

describe('une question tourne', () => {
  it('est vrai tant qu une question est servie, faux dès le verdict', () => {
    expect(isAnswering(state({ question }))).toBe(true)
    expect(isAnswering(state({ verdict }))).toBe(false)
  })

  it('est faux quand l état n est pas encore lu', () => {
    // La barre d'icônes s'en sert : un état absent ne doit pas l'effacer.
    expect(isAnswering(null)).toBe(false)
  })

  // Une attente raccourcie par un Répit reste une attente : à son échéance, le
  // rattrapage s'ouvre comme d'habitude. Le joueur doit le lire, sinon il croit
  // reprendre l'ascension et tombe sur un rattrapage.
  // Voir specs/bonus.md#répit.
  describe('attente écourtée', () => {
    it('la signale quand un Répit attend sur l attente en cours', () => {
      const built = state({
        phase: 'cooldown',
        effects: [{ spell: 'RESPITE', face: 'boon', casterName: 'gandalf', state: 'pending', lifetime: 'wait', stake: null }],
      })

      expect(gameScreen(built).shortenedWait).toBe(true)
    })

    it('ne la signale pas sans Répit', () => {
      const built = state({
        phase: 'cooldown',
        effects: [{ spell: 'VITALITY', face: 'boon', casterName: 'gandalf', state: 'pending', lifetime: 'attempt', stake: null }],
      })

      expect(gameScreen(built).shortenedWait).toBe(false)
    })

    it('ne la signale pas hors attente : il n y a plus rien à écourter', () => {
      const built = state({
        phase: 'ascent',
        effects: [{ spell: 'RESPITE', face: 'boon', casterName: 'gandalf', state: 'pending', lifetime: 'wait', stake: null }],
      })

      expect(gameScreen(built).shortenedWait).toBe(false)
    })
  })
})

describe('barrage de maintenance', () => {
  it('ne bloque rien tant que le jeu est ouvert', () => {
    expect(blockedByMaintenance(state({ maintenance: false }), '/')).toBe(false)
    expect(blockedByMaintenance(state({ maintenance: false }), '/sorts')).toBe(false)
  })

  it('bloque toutes les pages hors le jeu lui-même', () => {
    expect(blockedByMaintenance(state({ maintenance: true }), '/sorts')).toBe(true)
    expect(blockedByMaintenance(state({ maintenance: true }), '/profil')).toBe(true)
  })

  it('laisse finir une question ou un verdict déjà en cours, sur le jeu', () => {
    expect(blockedByMaintenance(state({ maintenance: true, question }), '/')).toBe(false)
    expect(blockedByMaintenance(state({ maintenance: true, verdict }), '/')).toBe(false)
  })

  it('bloque le jeu lui-même hors question ou verdict en cours', () => {
    expect(blockedByMaintenance(state({ maintenance: true }), '/')).toBe(true)
  })

  it('est faux quand l état n est pas encore lu', () => {
    expect(blockedByMaintenance(null, '/')).toBe(false)
  })
})
