import { beforeEach, describe, expect, it } from 'vitest'
import { installAppGlobals, testAdmin, testUser } from '../helpers/app'
import type { ContestableError, PendingDispute } from '../../server/utils/disputes'

const { serve, breakRead, breakNetwork, signIn, calls, refresh, reset } = installAppGlobals()

const { CONTESTABLE_KEY, useDisputes } = await import('../../composables/useDisputes')
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
    serve(CONTESTABLE_KEY, { errors: [ERROR] })

    const { errors, isContestable } = await useDisputes()

    expect(errors.value).toEqual([ERROR])
    expect(isContestable('q1')).toBe(true)
    expect(isContestable('q2')).toBe(false)
  })

  it('conteste puis relit la liste : le bouton disparaît de lui-même', async () => {
    const { contest } = await useDisputes()

    const sent = await contest('q1')

    expect(sent).toBe(true)
    expect(calls()).toEqual(['fetch POST /api/game/disputes'])
    expect(refresh).toHaveBeenCalledOnce()
  })

  it('signale une contestation refusée sans se dire illisible', async () => {
    breakNetwork()
    const { contest, failed } = await useDisputes()

    expect(await contest('q1')).toBe(false)
    expect(refresh).not.toHaveBeenCalled()
    expect(failed.value).toBe(false)
  })

  it('signale une lecture impossible', async () => {
    breakRead(CONTESTABLE_KEY)

    const { failed } = await useDisputes()

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
