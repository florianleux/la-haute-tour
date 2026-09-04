import { beforeEach, describe, expect, it } from 'vitest'
import { installAppGlobals, testUser } from '../helpers/app'
import type { MissedPoolEntryView } from '../../server/utils/game'

const { answerWith, breakNetwork, signIn, calls, reset } = installAppGlobals()

const { useMissedPool } = await import('../../composables/useMissedPool')

function entry(index: number): MissedPoolEntryView {
  return {
    questionId: `q${index}`,
    statement: `Question ${index} ?`,
    answerLabel: `RÉPONSE ${index}`,
    submittedAnswer: `réponse ${index}`,
    poolSuccesses: 0,
    lastFailedAt: '2026-09-03T12:00:00.000Z',
    disputeStatus: 'none',
  }
}

describe('Pool Échecs paginé', () => {
  beforeEach(() => {
    reset()
    signIn(testUser)
  })

  it('charge la première page, la plus récente d abord', async () => {
    answerWith({ entries: [entry(1)], total: 1 })
    const { loadMore, entries, total, hasMore } = useMissedPool()

    await loadMore()

    expect(calls()).toEqual(['fetch GET /api/game/pool?offset=0&order=desc'])
    expect(entries.value).toHaveLength(1)
    expect(total.value).toBe(1)
    expect(hasMore.value).toBe(false)
  })

  it('ajoute la page suivante à la suite, sans redemander la première', async () => {
    answerWith({ entries: [entry(1), entry(2)], total: 4 })
    const { loadMore, entries, hasMore } = useMissedPool()
    await loadMore()

    answerWith({ entries: [entry(3), entry(4)], total: 4 })
    await loadMore()

    expect(calls().at(-1)).toBe('fetch GET /api/game/pool?offset=2&order=desc')
    expect(entries.value.map(row => row.questionId)).toEqual(['q1', 'q2', 'q3', 'q4'])
    expect(hasMore.value).toBe(false)
  })

  it('repart de la première page quand le tri s inverse', async () => {
    answerWith({ entries: [entry(1)], total: 2 })
    const { loadMore, toggleOrder, entries, order } = useMissedPool()
    await loadMore()

    answerWith({ entries: [entry(2)], total: 2 })
    await toggleOrder()

    expect(order.value).toBe('asc')
    expect(calls().at(-1)).toBe('fetch GET /api/game/pool?offset=0&order=asc')
    expect(entries.value.map(row => row.questionId)).toEqual(['q2'])
  })

  it('ignore une bascule de tri pendant un chargement, plutôt que de vider la liste', async () => {
    answerWith({ entries: [entry(1)], total: 1 })
    const { loadMore, toggleOrder, entries, order } = useMissedPool()

    const inFlight = loadMore()
    await toggleOrder()
    await inFlight

    expect(order.value).toBe('desc')
    expect(entries.value).toHaveLength(1)
  })

  it('signale une page illisible plutôt que d afficher un pool vide', async () => {
    breakNetwork()
    const { loadMore, failed, entries } = useMissedPool()

    await loadMore()

    expect(failed.value).toBe(true)
    expect(entries.value).toHaveLength(0)
  })
})
