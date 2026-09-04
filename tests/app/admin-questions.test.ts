import { nextTick } from 'vue'
import { beforeEach, describe, expect, it } from 'vitest'
import { installAppGlobals, testAdmin } from '../helpers/app'
import type { AdminQuestion } from '../../server/utils/questions'

const { serve, breakRead, breakNetwork, signIn, calls, refresh, reset } = installAppGlobals()

const { ADMIN_QUESTIONS_KEY, useAdminQuestions } = await import('../../composables/useAdminQuestions')

const QUESTION: AdminQuestion = {
  id: 'q1',
  statement: 'Capitale de la Gironde ?',
  answerLabel: 'BORDEAUX',
  floor: 1,
  acceptedAnswers: ['Bordeaux'],
}

const DRAFT = {
  statement: 'Qui a découvert la pénicilline ?',
  answerLabel: 'FLEMING (Alexander)',
  floor: 3,
  acceptedAnswers: ['Fleming'],
}

describe('questions côté admin', () => {
  beforeEach(() => {
    reset()
    signIn(testAdmin)
  })

  it('rend les questions renvoyées par le serveur', async () => {
    serve(ADMIN_QUESTIONS_KEY, { questions: [QUESTION] })

    const { questions, failed } = await useAdminQuestions()

    expect(questions.value).toEqual([QUESTION])
    expect(failed.value).toBe(false)
  })

  it('relit le deck quand le filtre d étage change', async () => {
    const { floor } = await useAdminQuestions()
    refresh.mockClear()

    floor.value = 4
    await nextTick()

    expect(refresh).toHaveBeenCalledOnce()
  })

  it('crée une question puis relit le deck, au lieu de le deviner', async () => {
    const { create } = await useAdminQuestions()

    const created = await create(DRAFT)

    expect(created).toBe(true)
    expect(calls()).toEqual(['fetch POST /api/admin/questions'])
    expect(refresh).toHaveBeenCalledOnce()
  })

  it('édite une question et relit le deck', async () => {
    const { edit } = await useAdminQuestions()

    const edited = await edit('q1', {
      statement: 'Préfecture de la Gironde ?',
      answerLabel: 'BORDEAUX',
      acceptedAnswers: ['Bordeaux'],
    })

    expect(edited).toBe(true)
    expect(calls()).toEqual(['fetch PUT /api/admin/questions/q1'])
    expect(refresh).toHaveBeenCalledOnce()
  })

  it('supprime une question et relit le deck', async () => {
    const { remove } = await useAdminQuestions()

    const removed = await remove('q1')

    expect(removed).toBe(true)
    expect(calls()).toEqual(['fetch DELETE /api/admin/questions/q1'])
    expect(refresh).toHaveBeenCalledOnce()
  })

  it('reste occupé jusqu à ce que le deck soit relu, pas seulement écrit', async () => {
    const { create, saving } = await useAdminQuestions()

    const inFlight = create(DRAFT)
    expect(saving.value).toBe(true)
    await inFlight

    expect(saving.value).toBe(false)
  })

  it('signale une écriture refusée sans relire, et sans se dire illisible', async () => {
    breakNetwork()
    const { create, failed } = await useAdminQuestions()

    const created = await create(DRAFT)

    expect(created).toBe(false)
    expect(refresh).not.toHaveBeenCalled()
    // Une écriture refusée ne rend pas le deck illisible : deux nouvelles distinctes.
    expect(failed.value).toBe(false)
  })

  it('signale une lecture impossible', async () => {
    breakRead(ADMIN_QUESTIONS_KEY)

    const { failed } = await useAdminQuestions()

    expect(failed.value).toBe(true)
  })
})
