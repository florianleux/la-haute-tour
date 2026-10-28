import { describe, expect, it } from 'vitest'
import { blockedByMaintenance, dueLesson, fallQuestionId, gameScreen, isAnswering, isAtCamp, nextActionLabel, playView } from '../../utils/phase'
import { demoState as state } from '../../utils/demo'

describe('entrée dans la partie', () => {
  // Le bouton du poster, au camp : un mot, comme celui du rattrapage.
  it('propose de commencer au camp', () => {
    expect(nextActionLabel(state({ phase: 'ascent' }))).toBe('Commencer')
  })
})

const verdict = { questionId: 'q1', statement: 'Capitale ?', correct: false, answerLabel: 'BORDEAUX', submittedAnswer: 'Toulouse', lifeLost: true }
/** Un combat de boss en cours, son épreuve servie. */
const fight = {
  hp: 7,
  maxHp: 7,
  trial: { image: '0000000000000001', expiresAt: '2026-09-03T12:00:30.000Z', focusGraceMs: 1_000 },
  verdict: null,
  outcome: null,
}

/** La porte du boss verrouillée, le joueur devant elle. */
const lockedDoor = { unlocked: false, opened: false, hasKey: false, keyHolders: [], spot: 'door' as const }

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
    })
  })

  it('montre le verdict et propose la suite', () => {
    expect(gameScreen(state({ verdict }))).toMatchObject({
      question: null,
      verdict,
      phase: 'ascent',
    })
  })

  it('affiche le palier par-dessus le verdict de la dernière question', () => {
    expect(gameScreen(state({ phase: 'floorEnd', verdict }))).toMatchObject({
      verdict,
      phase: 'floorEnd',
    })
  })

  it('affiche la fin de partie par-dessus le verdict', () => {
    expect(gameScreen(state({ phase: 'gameOver', verdict }))).toMatchObject({
      verdict,
      phase: 'gameOver',
    })
  })

  it('annonce le sort du rattrapage dès que le verdict est scellé', () => {
    const ongoing = { total: 3, played: 1, successes: 0, resumes: false, sealed: false, required: 1 }

    expect(gameScreen(state({ phase: 'recovery', recovery: ongoing, verdict })).recovery)
      .toEqual({ position: 2, total: 3, successes: 0, required: 1, resumes: null })

    const resumed = { total: 3, played: 1, successes: 1, resumes: true, sealed: true, required: 1 }

    expect(gameScreen(state({ phase: 'recovery', recovery: resumed, verdict })).recovery)
      .toEqual({ position: 2, total: 3, successes: 1, required: 1, resumes: true })

    const failed = { total: 3, played: 3, successes: 0, resumes: false, sealed: true, required: 1 }

    expect(gameScreen(state({ phase: 'recovery', recovery: failed, verdict })).recovery?.resumes)
      .toBe(false)
  })
})

// Les leçons de Michel se jouent à leur moment, lu dans l'état servi.
// Voir specs/ecrans.md#leçons-de-michel.
describe('la leçon due', () => {
  const numbers = { total: 3, required: 1 }
  const inCooldown = { phase: 'cooldown' as const, lives: 0, cooldownUntil: '2099-01-01T00:00:00.000Z', nextRecovery: numbers }
  const overdue = { phase: 'recovery' as const, lives: 0, nextRecovery: numbers }

  it('est celle du camp au repos, tant qu elle n est pas vue', () => {
    expect(dueLesson(state({ lessonsDone: [] }))).toBe('camp')
    expect(dueLesson(state({ lessonsDone: ['camp'] }))).toBeNull()
  })

  it('est celle de la chute sans vies, l attente en cours ou échue', () => {
    expect(dueLesson(state({ ...inCooldown, lessonsDone: ['camp'] }))).toBe('fall')
    expect(dueLesson(state({ ...overdue, lessonsDone: ['camp'] }))).toBe('fall')
  })

  it('est celle du rattrapage l attente échue, la chute vue', () => {
    expect(dueLesson(state({ ...overdue, lessonsDone: ['camp', 'fall'] }))).toBe('recovery')
    expect(dueLesson(state({ ...inCooldown, lessonsDone: ['camp', 'fall'] }))).toBeNull()
  })

  it('n est aucune une fois tout vu, ou le rattrapage tiré', () => {
    expect(dueLesson(state({ ...overdue, lessonsDone: ['camp', 'fall', 'recovery'] }))).toBeNull()
    expect(dueLesson(state({ ...overdue, nextRecovery: null, lessonsDone: ['camp'] }))).toBeNull()
  })

  it('est celle du Grimoire au camp, le premier sort obtenu', () => {
    expect(dueLesson(state({ spellDiscovered: true, lessonsDone: ['camp'] }))).toBe('spellbook')
    expect(dueLesson(state({ spellDiscovered: false, lessonsDone: ['camp'] }))).toBeNull()
    expect(dueLesson(state({ spellDiscovered: true, lessonsDone: ['camp', 'spellbook'] }))).toBeNull()
  })

  it('passe le Grimoire après la chute et le rattrapage : une seule à la fois', () => {
    expect(dueLesson(state({ ...inCooldown, spellDiscovered: true, lessonsDone: ['camp'] }))).toBe('fall')
    expect(dueLesson(state({ ...inCooldown, spellDiscovered: true, lessonsDone: ['camp', 'fall'] }))).toBe('spellbook')
    expect(dueLesson(state({ ...overdue, spellDiscovered: true, lessonsDone: ['camp', 'fall'] }))).toBe('recovery')
    expect(dueLesson(state({ ...overdue, spellDiscovered: true, lessonsDone: ['camp', 'fall', 'recovery'] }))).toBe('spellbook')
  })

  it('ne joue pas le Grimoire hors du camp', () => {
    const answering = { question: { id: 'q1', statement: 'Capitale ?', expiresAt: '2099-01-01T00:00:00.000Z', focusGraceMs: 1_000, lootQuestion: false } }

    expect(dueLesson(state({ ...answering, spellDiscovered: true, lessonsDone: ['camp'] }))).toBeNull()
  })

  // Le joueur ne lance pas un rattrapage qu'on ne lui a pas expliqué.
  it('retient « Commencer » tant que la chute ou le rattrapage reste à voir', () => {
    expect(playView(state({ ...overdue, lessonsDone: ['camp'] })).action).toBeNull()
    expect(playView(state({ ...overdue, lessonsDone: ['camp', 'fall'] })).action).toBeNull()
    expect(playView(state({ ...overdue, lessonsDone: ['camp', 'fall', 'recovery'] })).action?.label).toBe('Commencer')
  })

  it('laisse la corde à la leçon du camp, qui la fait cliquer', () => {
    expect(playView(state({ lessonsDone: [] })).action).not.toBeNull()
  })
})

describe('camp (écran d attente)', () => {
  it('sert l attente elle-même', () => {
    expect(isAtCamp(state({ phase: 'cooldown', verdict }))).toBe(true)
  })

  it('sert le rattrapage prêt à démarrer', () => {
    expect(isAtCamp(state({ phase: 'recovery' }))).toBe(true)
  })

  // Le verdict de la question qui a pris la dernière vie reste dans l'état : il
  // ne doit pas faire relire le rattrapage au lieu du poster.
  it('sert le rattrapage prêt à démarrer malgré le verdict de la dernière vie', () => {
    expect(isAtCamp(state({ phase: 'recovery', verdict }))).toBe(true)
  })

  it('cède la place au rattrapage en cours, question servie comme verdict à lire', () => {
    const ongoing = { total: 3, played: 1, successes: 0, resumes: false, sealed: false, required: 1 }

    expect(isAtCamp(state({ phase: 'recovery', recovery: ongoing, question })))
      .toBe(false)
    expect(isAtCamp(state({ phase: 'recovery', recovery: ongoing, verdict })))
      .toBe(false)
  })

  // L'ascension au repos : rien de tiré, rien à lire. Voir specs/spec.md#glossaire (Au repos).
  it('accueille l ascension au repos', () => {
    expect(isAtCamp(state({ phase: 'ascent' }))).toBe(true)
  })

  it('laisse l ascension en cours, question servie comme verdict à lire', () => {
    expect(isAtCamp(state({ phase: 'ascent', question }))).toBe(false)
    expect(isAtCamp(state({ phase: 'ascent', verdict }))).toBe(false)
  })

  // Redescendu de la porte verrouillée. Voir specs/boss.md#attendre-au-camp.
  it('accueille le joueur redescendu de la porte, pas celui qui s y tient', () => {
    expect(isAtCamp(state({ phase: 'bossDoor', door: { ...lockedDoor, spot: 'camp' } }))).toBe(true)
    expect(isAtCamp(state({ phase: 'bossDoor', door: lockedDoor }))).toBe(false)
  })
})

describe('action de la page de jeu', () => {
  it('enchaîne sur la question suivante après un verdict d ascension', () => {
    expect(nextActionLabel(state({ phase: 'ascent', verdict }))).toBe('Suivant')
  })

  it('quitte le verdict de la dernière question de l étage d un « Suivant », vers la porte', () => {
    expect(nextActionLabel(state({ phase: 'floorEnd', verdict }))).toBe('Suivant')
  })

  it('franchit le palier d un « Continuer », boss battu', () => {
    expect(nextActionLabel(state({ phase: 'bossFight', boss: { ...fight, trial: null, outcome: 'victory' } }))).toBe('Continuer')
  })

  it('franchit le palier d un « Continuer », boss passé au 6e combat perdu', () => {
    expect(nextActionLabel(state({ phase: 'bossFight', lives: 0, boss: { ...fight, trial: null, outcome: 'passed' } }))).toBe('Continuer')
  })

  it('démarre, poursuit puis termine un rattrapage', () => {
    const ongoing = { total: 3, played: 0, successes: 0, resumes: false, sealed: false, required: 1 }

    expect(nextActionLabel(state({ phase: 'recovery' }))).toBe('Commencer')
    expect(nextActionLabel(state({ phase: 'recovery', recovery: ongoing, verdict })))
      .toBe('Suivant')

    const resumed = { total: 3, played: 1, successes: 1, resumes: true, sealed: true, required: 1 }
    expect(nextActionLabel(state({ phase: 'recovery', recovery: resumed, verdict })))
      .toBe('Reprendre')

    const failed = { total: 3, played: 3, successes: 0, resumes: false, sealed: true, required: 1 }
    expect(nextActionLabel(state({ phase: 'recovery', recovery: failed, verdict })))
      .toBe('Terminer')
  })
})

describe('coffre sur l écran de verdict', () => {
  it('cache le coffre tant qu une question est servie', () => {
    const closed = { opened: false, mimic: false, spell: null }

    expect(gameScreen(state({ question, verdict, chest: closed })).chest).toBeNull()
  })
})

describe('une question tourne', () => {
  it('est vrai tant qu une question est servie, faux dès le verdict', () => {
    expect(isAnswering(state({ question }))).toBe(true)
    expect(isAnswering(state({ verdict }))).toBe(false)
  })

  it('est faux quand l état n est pas encore lu', () => {
    expect(isAnswering(null)).toBe(false)
  })

})

describe('barrage de maintenance', () => {
  it('ne bloque rien tant que le jeu est ouvert', () => {
    expect(blockedByMaintenance(state({ maintenance: false }), '/')).toBe(false)
    expect(blockedByMaintenance(state({ maintenance: false }), '/profil')).toBe(false)
  })

  it('bloque toutes les pages hors le jeu lui-même', () => {
    expect(blockedByMaintenance(state({ maintenance: true }), '/profil')).toBe(true)
    expect(blockedByMaintenance(state({ maintenance: true }), '/admin')).toBe(true)
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

describe('carte de jeu', () => {
  const closed = { opened: false, mimic: false, spell: null }
  const opened = { opened: true, mimic: false, spell: 'RESPITE' as const }
  const right = { ...verdict, correct: true, lifeLost: false }
  const ongoing = { total: 3, played: 1, successes: 0, resumes: false, sealed: false, required: 1 }

  function card(overrides: Parameters<typeof state>[0], client?: Parameters<typeof playView>[1]) {
    const { card, action } = playView(state(overrides), client)
    return { card, action }
  }

  it('pose la question en ascension, sans autre bouton que répondre', () => {
    expect(card({ question })).toEqual({ card: 'question', action: null })
  })

  it('montre le camp à l ascension au repos, avec de quoi la commencer', () => {
    expect(card({})).toEqual({ card: 'cooldown', action: { label: 'Commencer', move: 'advance' } })
  })

  it('enchaîne sur la suite après un verdict', () => {
    expect(card({ verdict: right })).toEqual({ card: 'result', action: { label: 'Suivant', move: 'advance' } })
  })

  it('mène du verdict à l écran du coffre tant qu il est fermé', () => {
    expect(card({ verdict: right, chest: closed }))
      .toEqual({ card: 'result', action: { label: 'Suivant', move: 'enterChest', chestOf: verdict.questionId } })
    // Fermé, le coffre a son propre bouton : rien n'avance d'ici.
    expect(card({ verdict: right, chest: closed }, { chestOf: verdict.questionId, fallenOn: null }))
      .toEqual({ card: 'chest', action: null })
    expect(card({ verdict: right, chest: opened }, { chestOf: verdict.questionId, fallenOn: null }))
      .toEqual({ card: 'chest', action: { label: 'Suivant', move: 'advance' } })
  })

  it('oublie l écran du coffre dès que le verdict change', () => {
    // Le coffre d'une autre question : il repasse par son verdict.
    expect(card({ verdict: { ...right, questionId: 'q2' }, chest: closed }, { chestOf: verdict.questionId, fallenOn: null }))
      .toEqual({ card: 'result', action: { label: 'Suivant', move: 'enterChest', chestOf: 'q2' } })
  })

  it('montre le Mimic avant le poster, et le poster une fois quitté', () => {
    const mauled = { phase: 'cooldown' as const, lives: 0, verdict: right, chest: { opened: true, mimic: true, spell: null } }

    expect(card(mauled, { chestOf: verdict.questionId, fallenOn: null }))
      .toEqual({ card: 'chest', action: { label: 'Suivant', move: 'leave' } })
    // Quitté, ou la page rechargée : le poster.
    expect(card(mauled)).toEqual({ card: 'cooldown', action: null })
  })

  it('fait lire le verdict de la dernière vie avant le poster', () => {
    const fallen = { phase: 'cooldown' as const, lives: 0, verdict }

    expect(card(fallen, { chestOf: null, fallenOn: verdict.questionId }))
      .toEqual({ card: 'result', action: { label: 'Redescendre', move: 'leave' } })
    // Rechargée en pleine attente, la page va droit au poster.
    expect(card(fallen)).toEqual({ card: 'cooldown', action: null })
  })

  it('montre le poster, pas un verdict périmé, quand l attente s achève', () => {
    expect(card({ phase: 'recovery', lives: 0, verdict }))
      .toEqual({ card: 'cooldown', action: { label: 'Commencer', move: 'advance' } })
  })

  it('porte question et verdict du rattrapage sur la même carte', () => {
    expect(card({ phase: 'recovery', lives: 0, recovery: ongoing, question }))
      .toEqual({ card: 'recovery', action: null })
    expect(card({ phase: 'recovery', lives: 0, recovery: ongoing, verdict: { ...verdict, lifeLost: false } }))
      .toEqual({ card: 'recovery', action: { label: 'Suivant', move: 'advance' } })
  })

  it('lit le verdict de la dernière question avant la porte, et la fin de partie sur le sien', () => {
    expect(card({ phase: 'floorEnd', verdict: right }))
      .toEqual({ card: 'result', action: { label: 'Suivant', move: 'advance' } })
    expect(card({ phase: 'gameOver', verdict: right })).toEqual({ card: 'result', action: null })
  })

  // specs/boss.md : la porte, le combat, l'outro de défaite.
  it('mène à la porte une fois le verdict quitté : elle porte ses propres gestes', () => {
    expect(card({ phase: 'bossDoor', door: lockedDoor })).toEqual({ card: 'bossDoor', action: null })
  })

  // « Remonter » viendra avec climbToDoor : d'ici là, le camp n'avance rien.
  it('montre le camp sans bouton au joueur redescendu de la porte', () => {
    expect(card({ phase: 'bossDoor', door: { ...lockedDoor, spot: 'camp' } })).toEqual({ card: 'cooldown', action: null })
  })

  it('sert l épreuve sans autre bouton que répondre, puis la suite', () => {
    expect(card({ phase: 'bossFight', boss: fight })).toEqual({ card: 'bossFight', action: null })
    expect(card({ phase: 'bossFight', boss: { ...fight, trial: null } }))
      .toEqual({ card: 'bossFight', action: { label: 'Suivant', move: 'advance' } })
  })

  it('montre l outro de la défaite que la page retient, puis le camp', () => {
    const defeated = { phase: 'cooldown' as const, lives: 0, cooldownUntil: '2026-09-03T12:00:00.000Z', boss: { ...fight, trial: null, outcome: 'defeat' as const } }

    expect(card(defeated, { chestOf: null, fallenOn: null, bossEndOn: defeated.cooldownUntil }))
      .toEqual({ card: 'bossOutro', action: { label: 'Redescendre', move: 'leave' } })
    expect(card(defeated).card).toBe('cooldown')
  })

  it('montre la victoire du dernier étage sur l arène, puis la fin de partie', () => {
    const won = { phase: 'gameOver' as const, boss: { ...fight, hp: 0, trial: null, outcome: 'victory' as const } }

    expect(card(won, { chestOf: null, fallenOn: null, bossEndOn: 'victory' }))
      .toEqual({ card: 'bossFight', action: { label: 'Continuer', move: 'leave' } })
    expect(card(won)).toEqual({ card: 'result', action: null })
  })

  it('montre le passage du dernier étage sur l arène, puis la fin de partie', () => {
    const passed = { phase: 'gameOver' as const, lives: 0, boss: { ...fight, trial: null, outcome: 'passed' as const } }

    expect(card(passed, { chestOf: null, fallenOn: null, bossEndOn: 'passed' }))
      .toEqual({ card: 'bossFight', action: { label: 'Continuer', move: 'leave' } })
    expect(card(passed)).toEqual({ card: 'result', action: null })
  })
})

describe('verdict de la dernière vie', () => {
  it('retient le verdict qui ouvre l attente', () => {
    expect(fallQuestionId(state({ phase: 'cooldown', lives: 0, verdict }))).toBe(verdict.questionId)
  })

  it('laisse passer une vie perdue qui en laisse d autres', () => {
    expect(fallQuestionId(state({ lives: 2, verdict }))).toBeNull()
  })

  it('laisse passer le Mimic, dont le verdict était juste', () => {
    expect(fallQuestionId(state({ phase: 'cooldown', lives: 0, verdict: { ...verdict, correct: true, lifeLost: false } })))
      .toBeNull()
  })

  it('laisse passer le verdict de rattrapage, qui ne coûte pas de vie', () => {
    // L'attente échue, le rattrapage pas encore commencé : le verdict qui a
    // scellé le précédent reste dans l'état.
    expect(fallQuestionId(state({ phase: 'recovery', lives: 0, verdict: { ...verdict, lifeLost: false } })))
      .toBeNull()
  })
})
