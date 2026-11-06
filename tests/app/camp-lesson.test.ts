import { effectScope, isRef, nextTick, ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installAppGlobals } from '../helpers/app'
import { demoState } from '../../utils/demo'
import { dueLesson, isAtRest } from '../../utils/phase'
import { LESSON_PAUSE_MS, campLesson, crystalBallLesson, fallLesson, leechNetLesson, lessonStart, mushroomEatenLesson, mushroomLesson, quillLesson, recoveryLesson, spellbookLesson } from '../../utils/lessons'
import type { GameState } from '../../server/utils/game'
import type { Ref } from 'vue'
import type { Mock } from 'vitest'
import type { TeamId } from '../../shared/utils/teams'

const { answerWith, breakNetwork, calls, reset } = installAppGlobals()

// Les auto-imports dont le composable se sert, que Vitest ne pose pas.
Object.assign(globalThis, { dueLesson, isAtRest, campLesson, crystalBallLesson, fallLesson, leechNetLesson, lessonStart, mushroomEatenLesson, mushroomLesson, quillLesson, recoveryLesson, spellbookLesson, LESSON_PAUSE_MS })
const { fetchItems } = await import('../../composables/useItems')
Object.assign(globalThis, { fetchItems })

const { useCampLesson } = await import('../../composables/useCampLesson')

type CampLesson = ReturnType<typeof useCampLesson>

/** Le joueur qui sort de l'introduction : au camp au repos, leçon du camp à voir. */
const NEWCOMER = demoState({ lessonsDone: [] })

/** Le sac lu par la leçon : le Fromage encore dedans, ou déjà donné. */
const WITH_CHEESE = { items: ['CHEESE'], key: null }
const WITHOUT_CHEESE = { items: [], key: null }

let scope = effectScope()

/** Les relectures de l'état que le composable a demandées. */
let refreshes = 0

/**
 * Michel sur l'état servi donné. `refresh` relit l'état : par défaut, il ne fait
 * que se compter ; un test qui enchaîne deux leçons y pose ce que le serveur
 * rendrait.
 */
function start(state: GameState | Ref<GameState>, team: TeamId | null = 'MIDI', refresh = async (): Promise<void> => {
  refreshes += 1
}): CampLesson {
  return scope.run(() => useCampLesson(isRef(state) ? state : ref(state), ref(team), refresh))!
}

beforeEach(() => {
  vi.useFakeTimers()
  scope.stop()
  scope = effectScope()
  reset()
  refreshes = 0
})

afterEach(() => {
  vi.useRealTimers()
})

/** La dernière leçon envoyée au serveur pour être datée. */
function lastLessonDated(): string | undefined {
  return (globalThis as unknown as { $fetch: Mock }).$fetch.mock.lastCall?.[1]?.body?.lesson
}

/** Laisse passer la pause de Michel et la lecture du sac. */
async function settle(ms = 0): Promise<void> {
  await vi.advanceTimersByTimeAsync(ms)
  await nextTick()
}

/** Avance au clic sur la bulle jusqu'à la première réplique qui attend autre chose. */
function clickThrough(lesson: CampLesson): void {
  while (lesson.line.value && !lesson.line.value.awaits) {
    lesson.next()
  }
}

// Le déroulé de la leçon du camp, tel que la page de jeu le pilote.
// Voir specs/ecrans.md#leçons-de-michel.
describe('le déroulé de la leçon du camp', () => {
  beforeEach(() => {
    answerWith(WITH_CHEESE)
  })

  it('part dès l arrivée au camp, sur la pause : le camp ne répond déjà plus', () => {
    const lesson = start(NEWCOMER)

    expect(lesson.line.value?.awaits).toBe('pause')
  })

  it('crie « HÉ ! » une fois la pause passée', async () => {
    const lesson = start(NEWCOMER)

    await settle(LESSON_PAUSE_MS - 1)
    expect(lesson.line.value?.awaits).toBe('pause')

    await settle(1)
    expect(lesson.line.value).toMatchObject({ text: 'HÉ !', bubbleOnly: true })
  })

  it('ne se joue pas une fois vue', () => {
    expect(start(demoState({ lessonsDone: ['camp'] })).line.value).toBeNull()
  })

  it('ne se joue pas hors du camp au repos', () => {
    const inCooldown = demoState({ lessonsDone: [], phase: 'cooldown', lives: 0, cooldownUntil: new Date(Date.now() + 60_000).toISOString() })

    expect(start(inCooldown).line.value).toBeNull()
  })

  // Recharger en pleine leçon la reprend sans redonner ni perdre le Fromage.
  it('reprend juste après le don quand le Fromage n est plus dans le sac', async () => {
    answerWith(WITHOUT_CHEESE)
    const lesson = start(NEWCOMER)

    await settle()

    expect(lesson.line.value?.text).toBe('Miam ! Merci !')
    expect(calls()).toContain('fetch GET /api/game/items')
  })

  it('part du début si le sac ne se lit pas', async () => {
    breakNetwork()
    const lesson = start(NEWCOMER)

    await settle(LESSON_PAUSE_MS)

    expect(lesson.line.value?.text).toBe('HÉ !')
  })

  it('n avance que sur le geste que la réplique attend', async () => {
    const lesson = start(NEWCOMER)
    await settle(LESSON_PAUSE_MS)
    clickThrough(lesson)
    expect(lesson.line.value).toMatchObject({ spotlight: 'backpack', awaits: 'click' })

    lesson.done('close')
    expect(lesson.line.value?.spotlight).toBe('backpack')

    lesson.done('click')
    expect(lesson.line.value?.overlay).toBe('inventory')
  })

  it('va du sac à la corde puis à l au revoir, par les gestes attendus', async () => {
    const lesson = start(NEWCOMER)
    await settle(LESSON_PAUSE_MS)

    clickThrough(lesson)
    lesson.done('click') // le sac
    clickThrough(lesson)
    lesson.done('use') // le Fromage
    clickThrough(lesson)
    lesson.done('click') // la bannière
    clickThrough(lesson)
    lesson.done('close') // la bannière refermée
    clickThrough(lesson)
    expect(lesson.line.value).toMatchObject({ spotlight: 'rope', awaits: 'click' })

    lesson.done('click') // la corde
    expect(lesson.line.value?.awaits).toBe('ascent')
  })

  it('saute la bannière pour un joueur sans équipe', async () => {
    const lesson = start(NEWCOMER, null)
    await settle(LESSON_PAUSE_MS)

    clickThrough(lesson)
    lesson.done('click')
    clickThrough(lesson)
    lesson.done('use')
    clickThrough(lesson)

    expect(lesson.line.value?.spotlight).toBe('rope')
  })

  it('date la leçon au clic sur l au revoir, puis se tait', async () => {
    const lesson = start(NEWCOMER)
    await settle()

    await lesson.finish()

    expect(calls()).toContain('fetch POST /api/profile/lessons')
    expect(lesson.line.value).toBeNull()
  })
})

/** Le joueur revenu au camp après sa dernière vie, leçon du camp déjà vue. */
function fallen(overrides: Partial<GameState> = {}): GameState {
  return demoState({
    phase: 'cooldown',
    lives: 0,
    fallen: true,
    cooldownUntil: new Date(Date.now() + 60_000).toISOString(),
    nextRecovery: { total: 6, required: 1 },
    lessonsDone: ['camp'],
    ...overrides,
  })
}

/** Fait ce que la réplique attend — ouvrir ou refermer —, ou clique sa bulle. */
function act(lesson: CampLesson): void {
  const awaits = lesson.line.value?.awaits
  if (awaits === 'click' || awaits === 'close' || awaits === 'cast') {
    lesson.done(awaits)
  }
  else {
    lesson.next()
  }
}

// Voir specs/ecrans.md#leçons-de-michel (Chute).
describe('le déroulé de la leçon de la chute', () => {
  it('part au retour au camp après la dernière vie', () => {
    expect(start(fallen()).line.value?.awaits).toBe('pause')
  })

  it('part aussi l attente échue, tant que le rattrapage n a pas commencé', () => {
    expect(start(overdue()).line.value?.awaits).toBe('pause')
  })

  it('ne se joue pas une fois vue', () => {
    expect(start(fallen({ lessonsDone: ['camp', 'fall'] })).line.value).toBeNull()
  })

  it('ne se joue pas une fois le rattrapage tiré', () => {
    const drawn = { total: 3, played: 0, successes: 0, sealed: false, resumes: false, required: 1 }

    expect(start(fallen({ nextRecovery: null, recovery: drawn })).line.value).toBeNull()
  })

  it('se date au clic sur sa dernière réplique, puis se tait', async () => {
    const lesson = start(fallen())
    await settle(LESSON_PAUSE_MS)
    while (lesson.line.value) {
      expect(calls()).not.toContain('fetch POST /api/profile/lessons')
      act(lesson)
    }

    expect(calls()).toContain('fetch POST /api/profile/lessons')
  })
})

/** L'attente échue, rattrapage pas commencé. */
function overdue(overrides: Partial<GameState> = {}): GameState {
  return fallen({ phase: 'recovery', cooldownUntil: null, ...overrides })
}

/** Joue la leçon en cours jusqu'à ce que Michel se taise, et rend ce qu'il a dit. */
function playThrough(lesson: CampLesson): string[] {
  const spoken: string[] = []
  while (lesson.line.value) {
    spoken.push(lesson.line.value.text)
    act(lesson)
  }
  return spoken
}

// Voir specs/ecrans.md#leçons-de-michel (Rattrapage).
describe('le déroulé de la leçon du rattrapage', () => {
  it('part l attente échue, et annonce les chiffres servis', async () => {
    const lesson = start(overdue({ lessonsDone: ['camp', 'fall'] }))
    await settle(LESSON_PAUSE_MS)

    expect(playThrough(lesson).some(text => text.startsWith('Six questions'))).toBe(true)
  })

  it('ne se joue pas pendant l attente', () => {
    const lesson = start(fallen({ lessonsDone: ['camp', 'fall'] }))

    expect(lesson.line.value).toBeNull()
  })

  // « Commencer » revient avec l'état relu : la leçon y est vue. Voir playView.
  it('se date à sa dernière réplique, puis relit l état', async () => {
    const lesson = start(overdue({ lessonsDone: ['camp', 'fall'] }))
    await settle(LESSON_PAUSE_MS)

    playThrough(lesson)
    await settle()

    expect(calls()).toContain('fetch POST /api/profile/lessons')
    expect(refreshes).toBe(1)
  })

  it('ne se joue pas une fois vue', () => {
    expect(start(overdue({ lessonsDone: ['camp', 'fall', 'recovery'] })).line.value).toBeNull()
  })

  // Revenu après l'échéance sans avoir vu la chute : les deux leçons, à la suite.
  it('suit la leçon de la chute quand le joueur revient après l échéance', async () => {
    const served = ref(overdue())
    const lesson = start(served, 'MIDI', async () => {
      served.value = { ...served.value, lessonsDone: ['camp', 'fall'] }
    })
    await settle(LESSON_PAUSE_MS)

    expect(playThrough(lesson).at(-1)).toBe('On se voit une fois ton attente finie pour la suite !')
    await settle()

    expect(lesson.line.value?.awaits).toBe('pause')
    await settle(LESSON_PAUSE_MS)
    expect(playThrough(lesson).some(text => text.startsWith('Six questions'))).toBe(true)
  })
})

// Voir specs/ecrans.md#leçons-de-michel (Grimoire).
describe('le déroulé de la leçon du Grimoire', () => {
  /** Au camp au repos, le premier sort obtenu, encore à lancer. */
  const SPELLBOOK_DUE = demoState({ spellDiscovered: true, firstCastPending: true, lessonsDone: ['camp'] })

  /** Les gestes que la leçon a attendus, jouée jusqu'au bout. */
  function gestures(lesson: CampLesson): string[] {
    const asked: string[] = []
    while (lesson.line.value) {
      if (lesson.line.value.awaits) {
        asked.push(lesson.line.value.awaits)
      }
      act(lesson)
    }
    return asked
  }

  it('fait choisir puis lancer Vitalité, tant que le premier lancer reste à faire', async () => {
    const lesson = start(SPELLBOOK_DUE)
    await settle(LESSON_PAUSE_MS)

    expect(gestures(lesson)).toEqual(['click', 'click', 'cast', 'close'])
  })

  it('explique sans faire lancer quand le premier lancer est fait', async () => {
    const lesson = start({ ...SPELLBOOK_DUE, firstCastPending: false })
    await settle(LESSON_PAUSE_MS)

    expect(gestures(lesson)).toEqual(['click', 'close'])
  })

  it('se date à sa dernière réplique', async () => {
    const lesson = start(SPELLBOOK_DUE)
    await settle(LESSON_PAUSE_MS)

    playThrough(lesson)
    await settle()

    expect(calls()).toContain('fetch POST /api/profile/lessons')
  })

  it('ne se joue pas sans sort obtenu', () => {
    expect(start(demoState({ spellDiscovered: false, lessonsDone: ['camp'] })).line.value).toBeNull()
  })
})

describe('le déroulé de la leçon de la Plume', () => {
  /** Au camp, la Plume dans le sac, rien d'autre à voir. */
  const QUILL_DUE = demoState({ hasQuill: true, lessonsDone: ['camp', 'spellbook'] })

  it('fait ouvrir le Volumen puis le refermer, rien d autre', async () => {
    const lesson = start(QUILL_DUE)
    await settle(LESSON_PAUSE_MS)

    const asked: string[] = []
    while (lesson.line.value) {
      if (lesson.line.value.awaits) {
        asked.push(lesson.line.value.awaits)
      }
      act(lesson)
    }

    expect(asked).toEqual(['click', 'close'])
  })

  it('se date à sa dernière réplique', async () => {
    const lesson = start(QUILL_DUE)
    await settle(LESSON_PAUSE_MS)

    playThrough(lesson)
    await settle()

    expect(calls()).toContain('fetch POST /api/profile/lessons')
  })

  it('ne se joue pas sans la Plume', () => {
    expect(start(demoState({ hasQuill: false, lessonsDone: ['camp', 'spellbook'] })).line.value).toBeNull()
  })
})

describe('le déroulé de la leçon de la Boule de cristal', () => {
  /** Au camp, la Boule dans le sac, rien d'autre à voir. */
  const BALL_DUE = demoState({ hasCrystalBall: true, lessonsDone: ['camp', 'spellbook', 'quill'] })

  /** Michel montre la Boule : le Volumen est ouvert, il ne reste qu'à conclure. */
  async function showBall(): Promise<ReturnType<typeof start>> {
    const lesson = start(BALL_DUE)
    await settle(LESSON_PAUSE_MS)
    while (lesson.line.value?.spotlight !== 'wikipedia') {
      act(lesson)
    }
    return lesson
  }

  it('finit quand le Volumen se referme', async () => {
    const lesson = await showBall()

    lesson.done('close')
    await settle()

    expect(lesson.line.value).toBeNull()
    expect(calls()).toContain('fetch POST /api/profile/lessons')
  })

  it('finit au clic sur la Boule, le Volumen restant ouvert', async () => {
    const lesson = await showBall()

    lesson.next()
    await settle()

    expect(lesson.line.value).toBeNull()
    expect(calls()).toContain('fetch POST /api/profile/lessons')
  })
})

// Oui ou Non, la leçon est datée. Voir specs/champignon.md#leçon-de-michel.
describe('la leçon du Champignon', () => {
  async function untilQuestion(state: GameState | Ref<GameState> = demoState({ lessonsDone: ['camp'] })): Promise<CampLesson> {
    const lesson = start(state)

    lesson.askMushroom()
    expect(lesson.line.value).toMatchObject({ text: 'HÉ !', overlay: 'inventory' })
    clickThrough(lesson)
    expect(lesson.line.value).toMatchObject({ overlay: 'inventory', awaits: 'eat' })

    return lesson
  }

  it('oui : le sac se ferme, Michel attend que l intoxication monte, commente, puis la leçon se date', async () => {
    const state = ref(demoState({ lessonsDone: ['camp'] }))
    const lesson = await untilQuestion(state)

    lesson.done('eat')
    expect(lesson.line.value).toMatchObject({ text: '', overlay: 'inventory', awaits: 'close' })

    lesson.done('close')
    expect(lesson.line.value).toMatchObject({ text: '', awaits: 'haze' })

    // Le temps de la montée ne court qu'une fois l'intoxication servie.
    await vi.advanceTimersByTimeAsync(LESSON_PAUSE_MS)
    expect(lesson.line.value?.awaits).toBe('haze')

    state.value = { ...state.value, intoxicated: true }
    await nextTick()
    await vi.advanceTimersByTimeAsync(LESSON_PAUSE_MS)
    expect(lesson.line.value?.text).toMatch(/^Je te l'avais bien dit/)
    expect(lesson.line.value?.overlay).toBeUndefined()

    lesson.next()
    await settle()

    expect(lesson.line.value).toBeNull()
    expect(lastLessonDated()).toBe('mushroomEaten')
  })

  it('non puis un repas : Michel arrive une fois l intoxication montée, et commente', async () => {
    const lesson = start(demoState({ lessonsDone: ['camp', 'mushroom'], intoxicated: true, phase: 'ascent' }))

    expect(lesson.line.value).toMatchObject({ text: '', awaits: 'pause' })

    await vi.advanceTimersByTimeAsync(LESSON_PAUSE_MS)
    expect(lesson.line.value?.text).toMatch(/^Je te l'avais bien dit/)

    lesson.next()
    await settle()

    expect(lastLessonDated()).toBe('mushroomEaten')
  })

  it('non : la leçon s arrête et se date', async () => {
    const lesson = await untilQuestion()

    await lesson.finish()

    expect(lesson.line.value).toBeNull()
    expect(lastLessonDated()).toBe('mushroom')
    expect(refreshes).toBe(1)
  })
})
