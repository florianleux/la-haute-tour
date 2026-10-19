import { effectScope, nextTick, ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installAppGlobals } from '../helpers/app'
import { demoState } from '../../utils/demo'
import { isAtRest } from '../../utils/phase'
import { LESSON_PAUSE_MS, campLesson, lessonStart, replayedLesson } from '../../utils/lessons'
import type { GameState } from '../../server/utils/game'
import type { TeamId } from '../../shared/utils/teams'

const { answerWith, breakNetwork, calls, reset } = installAppGlobals()

// Les auto-imports dont le composable se sert, que Vitest ne pose pas.
Object.assign(globalThis, { isAtRest, campLesson, lessonStart, replayedLesson, LESSON_PAUSE_MS })
const { fetchItems } = await import('../../composables/useItems')
Object.assign(globalThis, { fetchItems })

const { useCampLesson } = await import('../../composables/useCampLesson')

type CampLesson = ReturnType<typeof useCampLesson>

/** Le joueur qui sort de l'introduction : au camp au repos, leçon du camp à voir. */
const NEWCOMER = demoState({ lessonsDone: [] })

/** Le sac lu par la leçon : le Fromage encore dedans, ou déjà donné. */
const WITH_CHEESE = { items: ['CHEESE'] }
const WITHOUT_CHEESE = { items: [] }

let scope = effectScope()

function start(state: GameState, team: TeamId | null = 'MIDI'): CampLesson {
  return scope.run(() => useCampLesson(ref(state), ref(team)))!
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
    vi.useFakeTimers()
    scope.stop()
    scope = effectScope()
    reset()
    answerWith(WITH_CHEESE)
  })

  afterEach(() => {
    vi.useRealTimers()
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

// Hors leçon, Michel propose de rejouer une leçon déjà vue.
describe('le rejeu d une leçon', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    scope.stop()
    scope = effectScope()
    reset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('propose les leçons vues, et de refuser', () => {
    const lesson = start(demoState({ lessonsDone: ['camp'] }))

    lesson.offer()

    expect(lesson.choices.value).toEqual(['Le camp', 'Non merci'])
  })

  it('ne propose rien sans leçon vue', () => {
    const lesson = start(demoState({ lessonsDone: [], phase: 'cooldown', cooldownUntil: new Date(Date.now() + 60_000).toISOString() }))

    lesson.offer()

    expect(lesson.line.value).toBeNull()
  })

  it('rejoue la leçon sans rien attendre, et sans rien dater', () => {
    const lesson = start(demoState({ lessonsDone: ['camp'] }))
    lesson.offer()

    lesson.choose(0)
    let spoken = 0
    while (lesson.line.value) {
      expect(lesson.line.value.awaits).toBeUndefined()
      lesson.next()
      spoken += 1
    }

    expect(spoken).toBeGreaterThan(5)
    expect(calls()).not.toContain('fetch POST /api/profile/lessons')
  })

  it('se tait sur « Non merci »', () => {
    const lesson = start(demoState({ lessonsDone: ['camp'] }))
    lesson.offer()

    lesson.choose(1)

    expect(lesson.line.value).toBeNull()
  })
})
