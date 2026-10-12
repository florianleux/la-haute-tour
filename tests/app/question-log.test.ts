import { beforeEach, describe, expect, it } from 'vitest'
import { installAppGlobals, testUser } from '../helpers/app'
import type { QuestionLogEntryView, QuestionLogPage } from '../../server/utils/game'

const { answerWith, breakNetwork, signIn, calls, reset } = installAppGlobals()

const { useQuestionLog } = await import('../../composables/useQuestionLog')

function entry(index: number): QuestionLogEntryView {
  return {
    questionId: `q${index}`,
    statement: `Question ${index} ?`,
    answerLabel: `RÉPONSE ${index}`,
    submittedAnswer: `réponse ${index}`,
    correct: false,
    poolSuccesses: 0,
    disputeStatus: 'none',
  }
}

function page(entries: QuestionLogEntryView[], total: number | null): QuestionLogPage {
  return { entries, total, poolSuccessesToLeave: 2 }
}

describe('Volumen paginé', () => {
  beforeEach(() => {
    reset()
    signIn(testUser)
  })

  it('lit l onglet À revoir dans le Pool Échecs', async () => {
    answerWith(page([entry(1)], 1))
    const { load, entries, pageCount, poolSuccessesToLeave } = useQuestionLog('missed')

    await load(1)

    expect(calls()).toEqual(['fetch GET /api/game/question-log?page=1&filter=missed'])
    expect(entries.value).toHaveLength(1)
    expect(pageCount.value).toBe(1)
    expect(poolSuccessesToLeave.value).toBe(2)
  })

  it('lit Sues et Toutes dans le journal, avec leur verdict', async () => {
    answerWith(page([], 0))

    await useQuestionLog('correct').load(1)
    await useQuestionLog('all').load(3)

    expect(calls()).toEqual([
      'fetch GET /api/game/question-log?page=1&filter=correct',
      'fetch GET /api/game/question-log?page=3&filter=all',
    ])
  })

  it('remplace la page affichée par celle demandée', async () => {
    answerWith(page([entry(1)], 21))
    const { load, entries, page: current, pageCount } = useQuestionLog('missed')
    await load(1)

    // Au-delà de la page 1, le serveur ne recompte pas : le total lu est gardé.
    answerWith(page([entry(21)], null))
    await load(2)

    expect(entries.value.map(row => row.questionId)).toEqual(['q21'])
    expect(current.value).toBe(2)
    expect(pageCount.value).toBe(2)
  })

  it('signale une page illisible plutôt que d afficher un journal vide', async () => {
    breakNetwork()
    const { load, failed, loaded } = useQuestionLog('all')

    await load(1)

    expect(failed.value).toBe(true)
    expect(loaded.value).toBe(false)
  })
})
