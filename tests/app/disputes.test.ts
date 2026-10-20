import { beforeEach, describe, expect, it } from 'vitest'
import { installAppGlobals, testAdmin, testUser } from '../helpers/app'
import type { DisputableError, PendingDispute } from '../../server/utils/disputes'

const { serve, answerWith, breakNetwork, signIn, calls, refresh, reset } = installAppGlobals()

const { useDisputes } = await import('../../composables/useDisputes')
const { ADMIN_DISPUTES_KEY, useAdminDisputes } = await import('../../composables/useAdminDisputes')

const ERROR: DisputableError = {
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
    const { errors, isDisputable, refresh } = useDisputes()
    await refresh()

    expect(errors.value).toEqual([ERROR])
    expect(isDisputable('q1')).toBe(true)
    expect(isDisputable('q2')).toBe(false)
  })

  it('conteste puis relit la liste : le bouton disparaît de lui-même', async () => {
    const { sendDispute } = useDisputes()

    const sent = await sendDispute('q1')

    expect(sent).toBe(true)
    expect(calls()).toEqual(['fetch POST /api/game/disputes', 'fetch GET /api/game/disputable-errors'])
  })

  it('retient la contestation partie, pour en accuser réception', async () => {
    const { sendDispute, isSent } = useDisputes()
    expect(isSent('q1')).toBe(false)

    await sendDispute('q1')

    expect(isSent('q1')).toBe(true)
    expect(isSent('q2')).toBe(false)
  })

  it('n accuse pas réception d une contestation refusée', async () => {
    breakNetwork()
    const { sendDispute, isSent } = useDisputes()

    await sendDispute('q1')

    expect(isSent('q1')).toBe(false)
  })

  it('pose disputingId pendant l envoi puis le relâche', async () => {
    const { sendDispute, disputingId } = useDisputes()

    const inFlight = sendDispute('q1')
    expect(disputingId.value).toBe('q1')
    await inFlight

    expect(disputingId.value).toBeNull()
  })

  it('signale une contestation refusée sans se dire illisible', async () => {
    breakNetwork()
    const { sendDispute, failed } = useDisputes()

    expect(await sendDispute('q1')).toBe(false)
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
