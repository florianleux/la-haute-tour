import { beforeEach, describe, expect, it } from 'vitest'
import { installAppGlobals, testUser } from '../helpers/app'
import type { Notices, SpellNotice } from '../../server/utils/notices'

const { answerWith, calls, reset, serve, signIn } = installAppGlobals()

const { NOTICES_KEY, useNotices } = await import('../../composables/useNotices')
const { useAchievementToasts } = await import('../../composables/useAchievementToasts')

const SPELL: SpellNotice = { id: 7, spell: 'VITALITY', face: 'boon', casterName: 'Saroumane', castAt: '2026-11-02T18:00:00.000Z' }
const NONE: Notices = { disputes: [], spells: [], achievements: [] }

describe('les nouvelles au camp', () => {
  beforeEach(() => {
    reset()
    signIn(testUser)
  })

  it('montre ce que le serveur sert', async () => {
    serve(NOTICES_KEY, { ...NONE, spells: [SPELL] })

    const { spells } = await useNotices()

    expect(spells.value).toEqual([SPELL])
  })

  it('« OK » envoie la lecture et réaffiche ce qui reste', async () => {
    serve(NOTICES_KEY, { ...NONE, spells: [SPELL] })
    const { spells, read } = await useNotices()
    answerWith(NONE)

    await read({ disputes: [], spells: [SPELL.id] })

    expect(calls()).toEqual(['fetch POST /api/game/notices/read'])
    expect(spells.value).toEqual([])
  })

  // Débloqués sans lui, ils s'annoncent à son retour, puis sont datés pour ne
  // pas revenir. Voir specs/succes.md#affichage.
  it('annonce les succès débloqués sans lui, puis les date', async () => {
    serve(NOTICES_KEY, { ...NONE, achievements: ['DISPUTE_ACCEPTED'] })
    answerWith(NONE)
    const toasts = useAchievementToasts()
    const { announceWaiting } = await useNotices()

    await announceWaiting()

    expect(toasts.value.map(toast => toast.id)).toEqual(['DISPUTE_ACCEPTED'])
    expect(calls()).toEqual(['fetch POST /api/game/notices/read'])
  })

  // Le rendu serveur lit les nouvelles aussi : un toast joué là, le joueur ne
  // le verrait jamais, et le serveur le croirait annoncé.
  it('n annonce rien à la seule lecture', async () => {
    serve(NOTICES_KEY, { ...NONE, achievements: ['DISPUTE_ACCEPTED'] })
    const toasts = useAchievementToasts()

    await useNotices()

    expect([toasts.value, calls()]).toEqual([[], []])
  })

  it('n écrit rien quand aucun succès n attend', async () => {
    serve(NOTICES_KEY, NONE)
    const { announceWaiting } = await useNotices()

    await announceWaiting()

    expect(calls()).toEqual([])
  })
})
