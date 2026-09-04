import { beforeEach, describe, expect, it } from 'vitest'
import { installAppGlobals, testUser } from '../helpers/app'
import type { JourneyStats } from '../../server/utils/journey'

const { serve, breakRead, signIn, reset } = installAppGlobals()

const { JOURNEY_KEY, useJourney } = await import('../../composables/useJourney')

const stats: JourneyStats = {
  floor: 3,
  floorSeen: 4,
  floorTotal: 8,
  seen: 26,
  correct: 19,
  bestStreak: 7,
  attempts: 4,
  longestAttempt: 12,
  shortestAttempt: 3,
  disputes: 3,
  disputesWon: 1,
}

describe('parcours', () => {
  beforeEach(() => {
    reset()
    signIn(testUser)
  })

  it('rend le parcours renvoyé par le serveur', async () => {
    serve(JOURNEY_KEY, { journey: stats })

    const { journey, failed } = await useJourney()

    expect(journey.value).toEqual(stats)
    expect(failed.value).toBe(false)
  })

  it('signale une lecture impossible plutôt qu un parcours vide', async () => {
    breakRead(JOURNEY_KEY)

    const { journey, failed } = await useJourney()

    // Des zéros diraient « tu n'as rien fait » là où le serveur n'a rien dit.
    expect(journey.value).toBeNull()
    expect(failed.value).toBe(true)
  })
})
