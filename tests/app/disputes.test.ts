import { beforeEach, describe, expect, it } from 'vitest'
import { installAppGlobals, testAdmin, testUser } from '../helpers/app'
import type { ContestableError, PendingDispute } from '../../server/utils/disputes'

const { serve, answerWith, breakNetwork, signIn, calls, refresh, reset } = installAppGlobals()

const { useDisputes } = await import('../../composables/useDisputes')
const { ADMIN_DISPUTES_KEY, useAdminDisputes } = await import('../../composables/useAdminDisputes')

const ERROR: ContestableError = {
  questionId: 'q1',
  statement: 'Capitale de la Gironde ?',
  answerLabel: 'BORDEAUX',
  submittedAnswer: 'Bordo',
}

const PENDING: PendingDispute = {
  id: 7,
  questionId: 'q1',
  username: 'gandalf',
  statement: 'Capitale de la Gironde ?',
  answerLabel: 'BORDEAUX',
  submittedAnswer: 'Bordo',
  acceptedAnswers: ['Bordeaux'],
}

describe('contestation côté joueur', () => {
  beforeEach(() => {
    reset()
    signIn(testUser)
  })

  it('ne propose de contester que ce que le serveur dit contestable', async () => {
    answerWith({ errors: [ERROR] })
    const { errors, isContestable, refresh } = useDisputes()
    await refresh()

    expect(errors.value).toEqual([ERROR])
    expect(isContestable('q1')).toBe(true)
    expect(isContestable('q2')).toBe(false)
  })

  it('conteste puis relit la liste : le bouton disparaît de lui-même', async () => {
    const { contest } = useDisputes()

    const sent = await contest('q1')

    expect(sent).toBe(true)
    expect(calls()).toEqual(['fetch POST /api/game/disputes', 'fetch GET /api/game/contestable'])
  })

  it('pose contestingId pendant l envoi puis le relâche', async () => {
    const { contest, contestingId } = useDisputes()

    const inFlight = contest('q1')
    expect(contestingId.value).toBe('q1')
    await inFlight

    expect(contestingId.value).toBeNull()
  })

  it('signale une contestation refusée sans se dire illisible', async () => {
    breakNetwork()
    const { contest, failed } = useDisputes()

    expect(await contest('q1')).toBe(false)
    expect(failed.value).toBe(false)
  })

  it('signale une lecture impossible', async () => {
    breakNetwork()
    const { failed, refresh } = useDisputes()
    await refresh()

    expect(failed.value).toBe(true)
  })
})

describe('file de contestation côté admin', () => {
  beforeEach(() => {
    reset()
    signIn(testAdmin)
  })

  it('rend les contestations en attente', async () => {
    serve(ADMIN_DISPUTES_KEY, { disputes: [PENDING] })

    const { disputes, failed } = await useAdminDisputes()

    expect(disputes.value).toEqual([PENDING])
    expect(failed.value).toBe(false)
  })

  it('arbitre puis relit la file', async () => {
    const { settle } = await useAdminDisputes()

    const settled = await settle(7, 'accepted')

    expect(settled).toBe(true)
    expect(calls()).toEqual(['fetch PUT /api/admin/disputes/7'])
    expect(refresh).toHaveBeenCalledOnce()
  })

  it('signale un arbitrage refusé', async () => {
    breakNetwork()
    const { settle } = await useAdminDisputes()

    expect(await settle(7, 'rejected')).toBe(false)
    expect(refresh).not.toHaveBeenCalled()
  })
})
