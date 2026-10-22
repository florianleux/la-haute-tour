import { beforeEach, describe, expect, it } from 'vitest'
import { setDatabase } from '../../server/db/client'
import { rulesForFloor } from '../../server/utils/rules'
import { createPlayer, createQuestion, createTestDatabase, loadPlayer } from '../helpers/db'
import { apiRequest, installNitroGlobals, jsonRequest, mountHandler, sessionCookieFor } from '../helpers/nitro'
import type { Database } from '../../server/db/client'

installNitroGlobals()

const { default: practiceGetHandler } = await import('../../server/api/game/practice.get')
const { default: practicePostHandler } = await import('../../server/api/game/practice.post')
const { default: stateHandler } = await import('../../server/api/game/state.get')

const readPractice = mountHandler('/practice', practiceGetHandler)
const answerPractice = mountHandler('/practice', practicePostHandler)
const readState = mountHandler('/state', stateHandler)

// La question d'essai de la leçon du camp : jugée comme une autre, hors partie.
// Voir specs/spec.md (glossaire, « Question d'essai ») et specs/ecrans.md#leçons-de-michel.
describe('la question d essai', () => {
  let db: Database
  let playerId: number
  let cookie: string

  beforeEach(async () => {
    db = await createTestDatabase()
    setDatabase(db)
    await createQuestion(db)
    playerId = await createPlayer(db)
    cookie = await sessionCookieFor(playerId)
  })

  function answer(text: string): Promise<Response> {
    return answerPractice(jsonRequest('http://test/practice', 'POST', { answer: text }, cookie))
  }

  it('refuse tout sans session', async () => {
    expect((await readPractice(apiRequest('http://test/practice'))).status).toBe(401)
    expect((await answerPractice(jsonRequest('http://test/practice', 'POST', { answer: 'Blanc' }))).status).toBe(401)
  })

  it('sert son énoncé et le chrono de l étage', async () => {
    const response = await readPractice(apiRequest('http://test/practice', cookie))

    expect(await response.json()).toEqual({
      id: 'practice',
      lootQuestion: false,
      statement: 'De quelle couleur était le cheval blanc d\'Henri IV ?',
      timerMs: rulesForFloor(1).ascentTimerMs,
    })
  })

  // Le verdict réaffiche la saisie, dans un cadre qui ne défile pas.
  it('refuse une saisie de plus de 60 caractères, comme une vraie réponse', async () => {
    expect((await answer('a'.repeat(61))).status).toBe(400)
    expect((await answer('a'.repeat(60))).status).toBe(200)
  })

  it('tolère une faute de frappe, comme une vraie question', async () => {
    expect(await (await answer('blamc')).json()).toMatchObject({ correct: true, submittedAnswer: 'blamc' })
  })

  it('juge faux ce qui n est pas la réponse, et la montre', async () => {
    expect(await (await answer('Noir')).json()).toMatchObject({
      correct: false,
      answerLabel: 'Blanc',
      submittedAnswer: 'Noir',
      lifeLost: false,
    })
  })

  it('ne touche à rien de la partie, juste ou fausse', async () => {
    const before = await (await readState(apiRequest('http://test/state', cookie))).json()
    const player = await loadPlayer(db, playerId)

    await answer('Blanc')
    await answer('Noir')
    await answer('')

    expect(await (await readState(apiRequest('http://test/state', cookie))).json()).toEqual(before)
    expect(await loadPlayer(db, playerId)).toEqual(player)
  })
})
