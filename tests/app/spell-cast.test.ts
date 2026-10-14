import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installAppGlobals } from '../helpers/app'
import type { CastHeadline } from '../../utils/spells'

installAppGlobals()

const { CHARGE_MS, FIZZLE_MS, RELEASE_MS, useSpellCast } = await import('../../composables/useSpellCast')

/** Ce que le titre annonce quand le sort est parti. */
const HEADLINE: CastHeadline = ['Sort lancé sur', 'toi !']

/** Une requête qui répond au bout de `ms` : le titre si le sort est parti, null sinon. */
function answerAfter(ms: number, headline: CastHeadline | null): () => Promise<CastHeadline | null> {
  return () => new Promise(resolve => setTimeout(() => resolve(headline), ms))
}

// Les étapes s'enchaînent sur des minuteurs : chaque test avance l'horloge
// lui-même plutôt que d'attendre trois secondes réelles.
describe('l animation d un lancer', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('monte en puissance, éclate, puis revient au repos', async () => {
    const { cast, play } = useSpellCast()

    const played = play('VITALITY', 'boon', answerAfter(200, HEADLINE))
    expect(cast.value).toEqual({ spell: 'VITALITY', face: 'boon', stage: 'charging', headline: null })

    await vi.advanceTimersByTimeAsync(CHARGE_MS)
    expect(cast.value).toEqual({ spell: 'VITALITY', face: 'boon', stage: 'release', headline: HEADLINE })

    await vi.advanceTimersByTimeAsync(RELEASE_MS)
    await played
    expect(cast.value).toBeNull()
  })

  it('s éteint quand le sort n est pas parti', async () => {
    const { cast, play } = useSpellCast()

    const played = play('PURGE', 'curse', answerAfter(200, null))

    await vi.advanceTimersByTimeAsync(CHARGE_MS)
    expect(cast.value?.stage).toBe('fizzle')

    await vi.advanceTimersByTimeAsync(FIZZLE_MS)
    await played
    expect(cast.value).toBeNull()
  })

  it('garde la montée tant que la requête n a pas répondu', async () => {
    const { cast, play } = useSpellCast()

    void play('RESPITE', 'boon', answerAfter(CHARGE_MS + 1000, HEADLINE))

    await vi.advanceTimersByTimeAsync(CHARGE_MS + 500)
    expect(cast.value?.stage).toBe('charging')

    await vi.advanceTimersByTimeAsync(500)
    expect(cast.value?.stage).toBe('release')
  })
})
